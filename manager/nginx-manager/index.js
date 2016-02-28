/* This module extends the usage of nginx.config template manager with key functions for stop/start the nginx service */
'use strict'

const fs = require('fs')
const path = require('path')
const exec = require('child_process').exec
const utils = require('custom/utils')
const template = require('./nginx-template')

/* Used for debug only */
const log = utils.log // eslint-disable-line no-unused-vars

/* This API is a direct extend to the template one since the started nginx service will use the completed nginx.config template */
const exportApi = template

;(function wrap () {
  /* The configuration file that nginx should use all the time */
  const nginxConfigFilePath = path.resolve(__dirname, 'nginx.conf')

  /* Convert the configuration from 'template' into nginx file format with location of 'nginxConfigFilePath' */
  function saveTemplateToFile () {
    return exportApi.getFullTemplate()
      .then((template) => new Promise(function (resolve, reject) {
        fs.writeFile(nginxConfigFilePath, template, 'utf8', function onWriteComplete (error) {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      }))
  }

  /* Do whatever it takes to stop all nginx related services */
  exportApi.serviceStop = function serviceStop () {
    return new Promise(function (resolve, reject) {
      const stopNginxServiceCommand = 'sudo service nginx stop'
      exec(stopNginxServiceCommand, function onNginxStopCommand (error, stdout, stderr) {
        if (error) {
          if (/service nginx stop\nstop: Unknown instance/.test(error.message)) {
            reject(new Error('Nginx main service is already stopped'))
            return
          }

          reject(new Error(`Unable to execute "${stopNginxServiceCommand}": ${error}`))
          return
        }

        if (stderr) {
          reject(new Error(`Executing "${stopNginxServiceCommand}" failed with: ${stderr}`))
          return
        }

        resolve(stdout)
      })
    })
    .catch(function onError () {
      /* Silence this error since we gonna try to stop the service from nginx CLI as well which may give a success */
    })
    .then(function (response) {
      return new Promise(function (resolve, reject) {
        const stopNginxCommand = 'sudo nginx -s stop'
        exec(stopNginxCommand, function onNginxStopCommand (error, stdout, stderr) {
          if (error) {
            if (/nginx\.pid" failed \(2: No such file or directory\)/.test(error)) {
              reject(new Error('Nginx service is already stopped'))
              return
            }

            reject(new Error(`Unable to execute "${stopNginxCommand}": ${error}`))
            return
          }

          if (stderr) {
            reject(new Error(`Executing "${stopNginxCommand}" failed with: ${stderr}`))
            return
          }

          resolve(stdout)
        })
      })
    })
  }

  /* Save the nginx.config from 'exportApi.getFullTemplate()' and use it to start nginx serving */
  exportApi.serviceStart = function serviceStart () {
    return saveTemplateToFile()
      .then(function startServiceWithConfig () {
        return new Promise(function (resolve, reject) {
          const startNginxCommand = `sudo nginx -c ${nginxConfigFilePath}`
          exec(startNginxCommand, function onNginxStartCommand (error, stdout, stderr) {
            if (error) {
              reject(new Error(`Unable to execute "${startNginxCommand}": ${error}`))
              return
            }

            if (stderr) {
              reject(new Error(`Executing "${startNginxCommand}" failed with: ${stderr}`))
              return
            }

            resolve(stdout)
          })
        })
      })
  }

  /*
    Save whatever changes might the nginx.config from 'exportApi.getFullTemplate()' have and
    send signal to nginx gracefully reload it
  */
  exportApi.serviceReload = function serviceReload () {
    return saveTemplateToFile()
      .then(() => new Promise(function (resolve, reject) {
        const reloadNginxCommand = 'sudo nginx -s reload'
        exec(reloadNginxCommand, function onNginxReloadCommand (error, stdout, stderr) {
          if (error) {
            reject(new Error(`Unable to execute "${reloadNginxCommand}": ${error}`))
            return
          }

          if (stderr) {
            reject(new Error(`Executing "${reloadNginxCommand}" failed with: ${stderr}`))
            return
          }

          resolve(stdout)
        })
      }))
  }
})()

module.exports = exportApi
