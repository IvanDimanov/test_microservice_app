/* Graceful way of stopping all system related resources */
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

const utils = require('custom/utils')
const instanceManager = require('./instance-manager')
const nginxManager = require('./nginx-manager')

/* Used for debug only */
const log = utils.log // eslint-disable-line no-unused-vars

/* Clear all system activities */
instanceManager.killMainDaemon()
  .then(log)
  .then(nginxManager.serviceStop)
  .then(log)
  .then(() => process.exit())
