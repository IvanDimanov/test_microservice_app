'use strict'

import EventEmitter from 'eventemitter3'
import {toString, getInstance} from 'custom/utils'
import socket from '../components/shared/socket-io'

const externalAPI = {}
const emitter = new EventEmitter()

function getAllInstances () {
  return socket
    .requestData('getAllInstances')
    .then(function responseValidation (list) {
      if (!(list instanceof Array)) {
        throw new TypeError(`1st argument "list" must be an {Array} but same is {${getInstance(list)}} ${toString(list)}`)
      }

      list.forEach(function validateInstance (instance, index) {
        if (!instance ||
            typeof instance !== 'object'
        ) {
          throw new TypeError(`1st argument "list" must be an {Array} of {Objects} but element at index #${index} is {${getInstance(instance)}} ${toString(instance)}`)
        }
      })

      return list
    })
}

function getAllInstancesTypes () {
  return socket.requestData('getAllInstancesTypes')
}

/* Example 'args' values '{"type": "prime-number"}' */
function getAllInstancesByType (args) {
  return socket.requestData('getAllInstancesByType', args)
}

/* Example 'args' values '{"type": "prime-number"}' */
function getTotalInstancesByType (args) {
  return socket.requestData('getTotalInstancesByType', args)
}

/* Example 'args' values '{"type": "prime-number", "newTotal": 5}' */
function setTotalInstancesByType (args) {
  return socket.requestData('setTotalInstancesByType', args)
}

externalAPI.emitter = emitter
externalAPI.getAllInstances = getAllInstances
externalAPI.getAllInstancesTypes = getAllInstancesTypes
externalAPI.getAllInstancesByType = getAllInstancesByType
externalAPI.getTotalInstancesByType = getTotalInstancesByType
externalAPI.setTotalInstancesByType = setTotalInstancesByType

export default externalAPI
