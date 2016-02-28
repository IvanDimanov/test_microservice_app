'use strict'

/* Top level error handler */
process.on('uncaughtException', function proggramCrashed (error) {
  console.log(' ')
  console.log(`   Final process Error at ${Date.now()}`)
  console.log('----------------------------------------------------------------')
  console.log(error instanceof Error ? error.stack : error)
  process.exit()
})

/* Triggered when a rejection occurred on a Promise that have no '.catch()' handler */
process.on('unhandledRejection', function uncaughtPromiseRejection (reason, promise) {
  console.log(' ')
  console.log(`   Unhandled Rejection at ${Date.now()}`)
  console.log('----------------------------------------------------------------')
  console.log(`Promise ${promise} reason: ${reason}`)
  process.exit()
})

const path = require('path')
const http = require('http')
const config = require('custom/config')
const utils = require('custom/utils')
const instanceManager = require('./instance-manager')
const nginxManager = require('./nginx-manager')

/* Used for debug only */
const log = utils.log // eslint-disable-line no-unused-vars

/*
  Use all services' details in 'config.services'
  to create services' running instances and
  to create proper nginx load balancers to route the traffic
*/
;(function setServiceInstancesAndLoadBalancing () {
  instanceManager.killMainDaemon()
    .catch((error) => log(`ERROR: Unable to stop running instance daemon: ${error.stack}`))

    .then(instanceManager.startMainDaemon)
    .catch((error) => {
      log(`FATAL ERROR: Unable to start instance daemon: ${error.stack}`)
      process.exit(1)
    })

    .then(nginxManager.serviceStop)
    .catch((error) => {
      /* No need to throw an error if we cannot kill a deamon that was never started */
      if (/Nginx service is already stopped/i.test(error.message)) {
        log('Nginx service is already stopped')
      } else {
        log(`ERROR: Unable to stop running nginx server: ${error.stack}`)
      }
    })

    .then(() => nginxManager.setMainFolderPath(path.resolve(__dirname, '..')))
    .then(() => nginxManager.setMonitorAddress(config.manager.address))

    /* Start all services' instances and load them in a Load Balancer */
    .then(() => Promise.all(
      Object.keys(config.services).map(function (serviceName) {
        const serviceConfig = config.services[serviceName]
        const serviceLoadBalancerName = `${serviceName}-balancer`

        return nginxManager.createLoadBalancer(serviceLoadBalancerName, `/api${serviceConfig.location}`, serviceConfig.location, 'least_conn')
          /* Create all instances in sequel since their ports are incremented on type base */
          .then(() => Array.from({length: serviceConfig.totalInitialInstances})
              .reduce((chain) => chain
                .then(() => instanceManager.startInstanceByType(serviceName))
                .then((instance) => nginxManager.addServerAddressToLoadBalancer(serviceLoadBalancerName, `${instance.ip}:${instance.port}`)),
                Promise.resolve()
              )
          )
      })
    ))

    .then(nginxManager.serviceStart)
    .then(() => log('Service Manager is up and running'))
    .catch((error) => {
      log(`FATAL ERROR: Unable to start nginx server: ${error.stack}`)
      process.exit(1)
    })
})()

/* Main purpose of this server is not to server HTTP traffic but WebSockets exclusively */
const httpServer = http.createServer(function onConnection (req, res) {
  /* TODO: Proper error log */
  log(`Unexpected request "${req.url}".\nThis server sould be used for WebSockets only.`)
  res.writeHead(404)
  res.end()
})

const socketIo = require('socket.io')(httpServer)

/* Give WebSocket access to all system stats, e.g. load, total active services/instances etc. */
require('./stats-manager')(socketIo)

/* Let connected sockets have access to main instances' API */
require('./instance-manager/socket-api')(socketIo)

/* Provide HTTP server access */
const startedHttpServer = httpServer.listen(config.manager.address.port, config.manager.address.ip, function onServerStarted () {
  const address = startedHttpServer.address()
  log(`${new Date()}: Server is up & running at http://${address.address}:${address.port}`)
  /* TODO: Compare "address.address / port" with "config.manager.address.ip / port" */
})
