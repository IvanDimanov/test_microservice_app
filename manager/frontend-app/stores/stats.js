'use strict'

import EventEmitter from 'eventemitter3'
import {log, toString} from 'custom/utils'
import socket from '../components/shared/socket-io'
import instanceStore from './instance'

const externalAPI = {}
const emitter = new EventEmitter()

/* Example 'args' values '{"timestamp": 1455612016671}' */
function getResponseStatsFromTimestamp (args) {
  return socket.requestData('getResponseStatsFromTimestamp', args)
}

/* Example 'args' values '{"serviceType": "prime-number", "timestamp": 1455612016671}' */
function getServiceTypeResponseStatsFromTimestamp (args) {
  return socket.requestData('getServiceTypeResponseStatsFromTimestamp', args)
}

/* Example 'args' values '{"timestamp": 1455612016671}' */
function getSegregatedResponseStatsFromTimestamp (args) {
  return socket.requestData('getSegregatedResponseStatsFromTimestamp', args)
}

/* Example 'args' values '{"serviceType": "prime-number", "timestamp": 1455612016671}' */
function getServiceTypeSegregatedResponseStatsFromTimestamp (args) {
  return socket.requestData('getServiceTypeSegregatedResponseStatsFromTimestamp', args)
}

/*
  This script will create a "ticking" mechanism which will emit all "instances types stats" in respectful timeout.
  Its purpose is to limit the need for components to start asking the Backend on-and-on about certain stats but
  just to subscribe for this continuum of updates and start managing data from there.
*/
{
  const tickerTimeout = 3000
  const latency = 100  /* The time needed to calculate the stats and send them back to the socket */

  emitter.getTickerTimeout = () => tickerTimeout

  ;(function emitStats () {
    /* Emits latest stats updates for the requested 'type' */
    function emitTypeStats (type) {
      return getServiceTypeResponseStatsFromTimestamp({
        serviceType: type,
        timestamp: Date.now() - tickerTimeout - latency
      })
      .then((stats) => emitter.emit(`${type}/responseStats`, stats))
    }

    /* Always get the latest Running Service Instances */
    instanceStore
      .getAllInstancesTypes()
      .then((types) => {
        Promise.all(types
          .map((type) => emitTypeStats(type))
        )
          .catch((error) => log(`Error: Unable to retrieve regular response stats: ${toString(error)}`))
          /* Even if the current attempt failed, that's no reason not to stop trying in a respectful timeout */
          .then(() => setTimeout(emitStats, tickerTimeout))
      })
      .catch((error) => log(`Error: ${toString(error)}`))
  })()
}

externalAPI.emitter = emitter
externalAPI.getResponseStatsFromTimestamp = getResponseStatsFromTimestamp
externalAPI.getServiceTypeResponseStatsFromTimestamp = getServiceTypeResponseStatsFromTimestamp
externalAPI.getSegregatedResponseStatsFromTimestamp = getSegregatedResponseStatsFromTimestamp
externalAPI.getServiceTypeSegregatedResponseStatsFromTimestamp = getServiceTypeSegregatedResponseStatsFromTimestamp

export default externalAPI
