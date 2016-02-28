/* The purpose of this module is to completely abstract the way we create and delete instances in PM2 */
'use strict'

const fs = require('fs')
const path = require('path')
const pm2 = require('pm2')
const EventEmitter = require('eventemitter3')
const config = require('custom/config')
const utils = require('custom/utils')

/* Used for debug only */
const log = utils.log // eslint-disable-line no-unused-vars
const toString = utils.toString

/* Used in 'onReady' calls */
const emitter = new EventEmitter()

/* Enrich the object determined for external use by keeping its private parts in a private scope */
const exportApi = {}
{
  /*
    This promise is a starting point for all exporting APIs.
    Promise resolved state will match whatever the 1st connection status is been established.
  */
  let onReadyPromise
  function reCreateReadyPromise () {
    onReadyPromise = new Promise(function (resolve, reject) {
      emitter.once('ready', resolve)
      emitter.once('ready-failed', reject)
    })
  }

  /*
    Returns all special business logic parameters that an instance may need to kickoff.
    Special attention to the way we generate incremented connection ports.
  */
  function getNewInstanceProps (type, total) {
    const defaultPort = `${config.services[type].address.defaultPort}`
    const portPrefix = defaultPort.substr(0, defaultPort.length - 2)
    const portSuffix = total + 1
    const port = `${portPrefix}${portSuffix > 9 ? portSuffix : `0${portSuffix}`}`

    /*
      Generated 'port' should look something like '6101', '6123' while
      generated 'name': 'prime-number-6101', 'prime-number-6123'
    */
    return {
      port,
      name: `${type}-${port}`
    }
  }

  /*
    We use a promise binding so we can execute functions that are sent via 'exportApi.onReady'
    even after the call of emitter.emit('ready')
  */
  exportApi.onReady = function onReady (fn) {
    onReadyPromise.then(fn)
  }

  /* Try to kill the managing PM2 daemon which will immediately take all of its instances down */
  exportApi.killMainDaemon = function killMainDaemon () {
    return onReadyPromise.then(() => new Promise(function (resolve, reject) {
      pm2.killDaemon(function onComplete (error, result) {
        pm2.disconnect()
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      })
    }))
  }

  /*
    Tries to establish a connection to a PM2 daemon if such exists.
    If there's currently no running daemon, PM2 will automatically create one.
  */
  exportApi.startMainDaemon = function startMainDaemon () {
    /*
      Since this program is executed with sudo (as admin coz nginx needs to be called on the highest level)
      PM2 will be executed with sudo too, which makes accessing it through the CLI impossible
      for all non-sudo users that had this access before.
      In order to lower this restriction to its previous level,
      we'll reset main PM2 sockets to their basic access permissions.
    */
    function resetAccessFilesPermissions () {
      /*
        Returns home directory in platform agnostic way.
        Full credit to http://stackoverflow.com/a/9081436
      */
      function getUserHomeDirectoryPath () {
        return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']
      }

      function resetFilePermissions (filePath) {
        fs.stat(filePath, (error, stats) => {
          if (error) {
            log(`ERROR: Unable to track file "${filePath}": ${error.stack}`)
            return
          }
          if (!stats.isSocket()) {
            log(`ERROR: Unable to change permissions to socket "${filePath}" since it is not a socket`)
            return
          }

          fs.chmod(filePath, '777', (error) => error && console.log(`ERROR: Unable to change permissions to socket "${filePath}": ${error.stack}`))
        })
      }

      resetFilePermissions(path.resolve(getUserHomeDirectoryPath(), '.pm2/rpc.sock'))
      resetFilePermissions(path.resolve(getUserHomeDirectoryPath(), '.pm2/interactor.sock'))
    }

    reCreateReadyPromise()
    pm2.connect(function onConnect (error) {
      if (error) {
        log(`ERROR: Unable to connect to "pm2": ${error}`)
        emitter.on('ready-failed', error)
        return
      }

      /* Let know all subscribers (the promise above) about the successfully established connection */
      emitter.emit('ready')

      /* Reduce PM2 CLI access permission from sudo (admin) to all users that used to have it */
      resetAccessFilesPermissions()
    })
  }

  /*
    Returns a list of internally created instances in the PM2 environment,
    presented by special set of "SERVICE_MANAGER_PROPS" JSON
  */
  exportApi.getAllInstances = function getAllInstances () {
    return onReadyPromise.then(function onReady () {
      return new Promise(function (resolve, reject) {
        pm2.list(function getAllInstanes (error, list) {
          if (error) {
            resolve(error)
          } else {
            /* Identify each instance by a configuration set on inception */
            const internalInstances = list
              .map((instance) => utils.JSON_parse((instance.pm2_env.env || {}).SERVICE_MANAGER_PROPS))
              .filter((instance) => typeof instance === 'object')
            resolve(internalInstances)
          }
        })
      })
    })
  }

  /* Returns an array of types (['prime-number', 'random-string', ...]) */
  exportApi.getAllInstancesTypes = function getAllInstancesTypes () {
    return exportApi.getAllInstances()
      .then((list) => list
        .reduce((set, instance) => {
          if (!~set.indexOf(instance.type)) {
            set.push(instance.type)
          }
          return set
        }, [])
      )
  }

  exportApi.isValidServiceType = function isValidServiceType (type) {
    return new Promise(function (resolve, reject) {
      if (!config.services[type] ||
          typeof config.services[type] !== 'object'
      ) {
        reject(new TypeError(`Service type "${type} is invalid"`))
      } else {
        resolve()
      }
    })
  }

  /* Useful for knowing all PM2 instances by a specific 'type' which are normally set under same Load Balancer */
  exportApi.getAllInstancesByType = function getAllInstancesByType (type) {
    return exportApi.isValidServiceType(type)
      .then(exportApi.getAllInstances)
      .then((list) => list.filter((instance) => instance.type === type))
  }

  exportApi.getTotalInstancesByType = function getTotalInstancesByType (type) {
    return exportApi.getAllInstancesByType(type)
      .then((list) => list.length)
  }

  /* Uses the PM2 interface to stop and remove any trace of a running instance */
  exportApi.deleteInstanceByName = function deleteInstanceByName (name) {
    return exportApi.getAllInstances()
      .then(function (list) {
        const instance = list.filter((instance) => instance.name === name).pop()

        if (!instance ||
            typeof instance !== 'object'
        ) {
          throw new Error(`Unable to delete instance with name "${name}" since there is no running instance with this name`)
        }

        return instance
      })
      .then((instance) => new Promise(function (resolve, reject) {
        pm2.delete(`${config.manager.instance.namePrefix}${name}`, function onProcessDelete (errorStatus) {
          if (errorStatus) {
            if (typeof errorStatus.msg === 'string') {
              reject(errorStatus.msg)
            } else {
              reject(errorStatus)
            }
          } else {
            resolve(instance)
          }
        })
      }))
  }

  /* Useful for reducing (hopefully) unused instances of the same type and most probably under same Load Balancer */
  exportApi.deleteInstanceByType = function deleteInstanceByType (type) {
    return exportApi.getAllInstancesByType(type)
      .then(function (list) {
        const instance = list.filter((instance) => instance.type === type).pop()

        if (!instance ||
            typeof instance !== 'object'
        ) {
          throw new Error(`Unable to delete instance of type "${type}" since there are no running instances of this type`)
        }

        return exportApi.deleteInstanceByName(instance.name)
      })
  }

  /* Try to put one more instance running, having its own communication port and natural markers as "SERVICE_MANAGER_PROPS" */
  exportApi.startInstanceByType = function startInstanceByType (type) {
    return exportApi.isValidServiceType(type)
      .then(() => exportApi.getTotalInstancesByType(type))
      .then(function isLimitReached (total) {
        if (config.services[type].maximumRunningInstances <= total) {
          throw new RangeError(`Cannot start new instance of type "${type}" since the limitt of maximum running instances of ${config.services[type].maximumRunningInstances} is already reached`)
        }
        return total
      })
      .then((total) => getNewInstanceProps(type, total))
      .then(function startInstance (options) {
        return new Promise(function (resolve, reject) {
          const fullName = `${config.manager.instance.namePrefix}${options.name}`
          const SERVICE_MANAGER_PROPS = {
            fullName,
            name: options.name,
            type,
            ip: '127.0.0.1',
            port: options.port,
            startTimestamp: Date.now()
          }

          pm2.start({
            name: fullName,
            script: path.resolve(__dirname, '../../services', type), /* TODO: Maybe put '../services' as a config location */
            args: ['--port', options.port],
            env: {
              /* Highest Node.js performance, especially from Express.js apps: http://expressjs.com/en/advanced/best-practice-performance.html */
              NODE_ENV: 'production',

              /* Gave something that this same program can later use to identify its instance */
              SERVICE_MANAGER_PROPS: SERVICE_MANAGER_PROPS
            },
            /* TODO: Maye put 'logs' as a config location */
            merge_logs: true,
            out_file: path.resolve(__dirname, 'logs', `${fullName}.log`),
            error_file: path.resolve(__dirname, 'logs', `${fullName}.error.log`),
            pid_file: path.resolve(__dirname, 'logs', `${fullName}.pid.log`)
          }, function onProcessStart (error) {
            if (error) {
              reject(new Error(`Unable to start service instance of type "${type}": ${toString(error)}`))
            } else {
              resolve(SERVICE_MANAGER_PROPS)
            }
          })
        })
      })
  }
}

/* Initially prepare the process so the callee can immediately start using the inner API such as 'startInstanceByType()' */
exportApi.startMainDaemon()

module.exports = exportApi
