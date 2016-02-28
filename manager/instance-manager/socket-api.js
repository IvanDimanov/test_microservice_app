/* This module binds socket calls to a limited number of nginx and instance managers' functions. */
'use strict'

const utils = require('custom/utils')
const instanceManager = require('./index.js')
const nginxManager = require('../nginx-manager')

/* Used for debug only */
const log = utils.log // eslint-disable-line no-unused-vars

/*
  Gives some control to a socket over a part of the nginx and instance managers.
  Using those APIs, any connected socket can read how many working instances are there and alter their number.
*/
/* TODO: Auth will fit nicely here */
function bindSocketApi (socketIo) {
  socketIo.on('connection', function onSocketConnect (socket) {
    socket.on('getAllInstances', (args) => {
      instanceManager.getAllInstances()
        /* TODO: Maybe its a good idea to remove some private instance properties
                 since these calls came from external system API
        */
        .then((list) => {
          if (!args ||
              typeof args !== 'object' ||
              !args.requestId
          ) {
            socket.emit('getAllInstances', list)
          } else {
            socket.emit('getAllInstances', {
              requestId: args.requestId,
              data: list
            })
          }
        })
        .catch((error) => log(`ERROR: Unable to respond to socket request "getAllInstances": ${error.stack}`))
    })

    socket.on('getAllInstancesTypes', (args) => {
      instanceManager.getAllInstancesTypes()
        .then((types) => {
          if (!args ||
              typeof args !== 'object' ||
              !args.requestId
          ) {
            socket.emit('getAllInstancesTypes', types)
          } else {
            socket.emit('getAllInstancesTypes', {
              requestId: args.requestId,
              data: types
            })
          }
        })
        .catch((error) => log(`ERROR: Unable to respond to socket request "getAllInstancesTypes": ${error.stack}`))
    })

    socket.on('getAllInstancesByType', (args) => {
      if (!args ||
          typeof args !== 'object'
      ) {
        return
      }

      instanceManager.getAllInstancesByType(args.type)
        .then((list) => socket.emit('getAllInstancesByType', {
          requestId: args.requestId,
          data: list
        }))
        .catch((error) => log(`ERROR: Unable to respond to socket request "getAllInstancesByType": ${error.stack}`))
    })

    socket.on('getTotalInstancesByType', (args) => {
      if (!args ||
          typeof args !== 'object'
      ) {
        return
      }

      instanceManager.getTotalInstancesByType(args.type)
        .then((total) => socket.emit('getTotalInstancesByType', {
          requestId: args.requestId,
          data: total
        }))
        .catch((error) => log(`ERROR: Unable to respond to socket request "getTotalInstancesByType": ${error.stack}`))
    })

    /*
      Manage the total number of active services/instances of a certain type.
      Mainly used to handle higher or lower usage flow.
    */
    /* Example 'args' values '{"type": "prime-number", "newTotal": 5}' */
    socket.on('setTotalInstancesByType', (args) => {
      if (!args ||
          typeof args !== 'object'
      ) {
        return
      }

      instanceManager.getTotalInstancesByType(args.type)
        /* Decide if we need to add or remove instances and how many */
        .then(function setChangeDirection (currentTotal) {
          const diff = currentTotal - args.newTotal
          return {
            diff,
            fns: {
              instanceManagerFn: diff < 0 ? 'startInstanceByType' : 'deleteInstanceByType',
              nginxManagerFn: diff < 0 ? 'addServerAddressToLoadBalancer' : 'removeServerAddressFromLoadBalancer'
            }
          }
        })

        .then(function shouldChangeTotalInstances (request) {
          if (!request.diff) {
            return
          }

          const serviceLoadBalancerName = `${args.type}-balancer`

          /*
            Creates a sequence of adding or removing actions that will set the exact number of instances right to 'newTotal'.
            We need to follow this flow as a sequence and not as parallel because
            creating an instance must have its port as an increment from those instances already set.
          */
          Array.from({length: Math.abs(request.diff)})
            .reduce((chain) => chain
              .then(() => instanceManager[request.fns.instanceManagerFn](args.type))
              .then((instance) => nginxManager[request.fns.nginxManagerFn](serviceLoadBalancerName, `${instance.ip}:${instance.port}`)),
              Promise.resolve()
            )
            .then(nginxManager.serviceReload)
            .then(() => {
              const message = `nginx server restarted with ${args.newTotal} services of type "${args.type}"`
              log(message)
              socket.emit('setTotalInstancesByType', {
                requestId: args.requestId,
                data: message
              })
            })
            .catch((error) => {
              const message = `ERROR: Unable to start nginx server with ${args.newTotal} services of type "${args.type}": ${error.stack}`
              log(message)
              socket.emit('setTotalInstancesByType', {
                requestId: args.requestId,
                error: message
              })
            })
        })
    })
  })
}

module.exports = bindSocketApi
