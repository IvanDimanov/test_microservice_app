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

/* Used for debug only */
function log () { // eslint-disable-line no-unused-vars
  return console.log.apply(console, arguments)
}

const path = require('path')
const argv = require('yargs').argv
const redis = require('redis')
const express = require('express')
const bodyParser = require('body-parser')
const config = require('custom/config')

/* Service indentation based on its location */
const serviceType = path.basename(__dirname)
const port = argv.port || config.services[serviceType].address.defaultPort
const serviceName = `${serviceType}-${port}`

/* TODO: Authentication using 'config' */
const emitter = redis.createClient(config.database.redis.communicator.address.port, config.database.redis.communicator.address.ip)
const db = redis.createClient(config.database.redis.archive.address.port, config.database.redis.archive.address.ip)

const app = express()

/* No need for revealing the Backend serving mechanism */
app.disable('x-powered-by')

/* Keep internal track of all incoming requests */
app.use(function trackIncomingRequest (req, res, next) {
  /* Used at later point to calculate request duration time */
  req.timestamp = Date.now()

  /* Using JSON stringified form for quicker Redis access */
  const statStringObject = `{"url":"${req.url}","timestamp":${req.timestamp},"service":{"name":"${serviceName}","type":"${serviceType}"}}`
  db.rpush('system/requests', statStringObject)
  emitter.publish('system/requests', statStringObject)

  /* Involve the service calculation */
  next()
})

/*
  Parse all the incoming update requests
  as JSON or application/x-www-form-urlencoded
*/
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

/* Bind service methods to callable routes */
app.use(require('./router'))

/* Emit general request stats so we can track global system traffic */
app.use(function trackCompleteRequest (req, res, next) {
  const timestamp = Date.now()
  /* Using JSON stringified form for quicker Redis access */
  const statStringObject = `{"url":"${req.url}","timestamp":${timestamp},"duration":${timestamp - req.timestamp},"service":{"name":"${serviceName}","type":"${serviceType}"}}`
  db.rpush('system/responses', statStringObject)
  emitter.publish('system/responses', statStringObject)

  next()
})

/* Kickoff with the Express server, ready to accept requests */
const server = app.listen(port, config.services[serviceType].address.ip, function onServerStarted () {
  log(`${new Date()}: Express server is up & running at http://${server.address().address}:${server.address().port}`)
  /* TODO: Compare "server.address().address / port" with "config.services[serviceType].address.ip / port" */
})
