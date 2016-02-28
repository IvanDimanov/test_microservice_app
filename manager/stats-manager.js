/*
  This module will collect and manage system stats.
  It'll export API getters for specific stats information through given socket connection.
*/
'use strict'

const fs = require('fs')
const path = require('path')
const redis = require('redis')
const Shavaluator = require('redis-evalsha')
const config = require('custom/config')
const utils = require('custom/utils')

/* TODO: Authentication using 'config' */
const emitter = redis.createClient(config.database.redis.communicator.address.port, config.database.redis.communicator.address.ip)
const db = redis.createClient(config.database.redis.archive.address.port, config.database.redis.archive.address.ip)
const shavaluator = new Shavaluator(db)

/* Used for debug only */
const log = utils.log // eslint-disable-line no-unused-vars

/*
  Holds all system service stats in an ordered time fashion
  starting from 'Date.now()' till 'config.manager.stats.oldestStatsTimestamp'.
  All stats are combined on the seconds (not the timestamp milliseconds) they were respond.
*/
const responseStats = {}

/* Clear old stats for minimum memory footprint */
;(function removeOldStatsWrap () {
  function removeOldStats () {
    log('\nINFO: Clearing old stats')
    const timeLimit = Math.floor((Date.now() - config.manager.stats.oldestStatsTimestamp) / 1000)
    Object.keys(responseStats).forEach(function onEachServiceType (serviceType) {
      log(`INFO: Current "${serviceType}" stats: ${Object.keys(responseStats[serviceType]).length}`)
      Object.keys(responseStats[serviceType]).forEach(function removeOldStat (time) {
        if (time <= timeLimit) {
          delete responseStats[serviceType][time]
        }
      })
      log(`INFO: Reduced "${serviceType}" stats: ${Object.keys(responseStats[serviceType]).length}`)
    })
    setTimeout(removeOldStats, config.manager.stats.oldestStatsTimestamp)
  }

  setTimeout(removeOldStats, config.manager.stats.oldestStatsTimestamp)
})()

/* Records new system service stats to 'responseStats' in a common form based on their response time */
function recordResponseStats (responseString) {
  const response = utils.JSON_parse(responseString)
  if (!response ||
      typeof response !== 'object'
  ) {
    /* Proper error handling */
    log(new TypeError(`1st argument must be JSON {String} but is {${utils.getInstance(responseString)}} ${utils.toString(responseString)}`))
    return
  }

  /* In order to reduce memory usage, we'll aggregate stats types to the nearest seconds they were respond */
  const time = Math.floor(response.timestamp / 1000)

  /* Combine all services stats in a single stack */
  if (!responseStats.all ||
      typeof responseStats.all !== 'object'
  ) {
    responseStats.all = {}
  }

  if (!responseStats.all[time] ||
      typeof responseStats.all[time] !== 'object'
  ) {
    responseStats.all[time] = {
      total: 0,
      durations: []
    }
  }

  responseStats.all[time].total++
  responseStats.all[time].durations.push(response.duration)

  /* Save each service type response stats */
  if (!responseStats[response.service.type] ||
      typeof responseStats[response.service.type] !== 'object'
  ) {
    responseStats[response.service.type] = {}
  }

  if (!responseStats[response.service.type][time] ||
      typeof responseStats[response.service.type][time] !== 'object'
  ) {
    responseStats[response.service.type][time] = {
      total: 0,
      durations: []
    }
  }

  responseStats[response.service.type][time].total++
  responseStats[response.service.type][time].durations.push(response.duration)
}

/*
  Record only each service response stats (not request stats) because
  each response stat have a 'duration' property that can give use the request time
*/
emitter.on('message', function onMessage (channel, responseString) {
  if (channel !== 'system/responses') {
    return
  }

  recordResponseStats(responseString)
})

/* Follow all system service response stats events */
emitter.subscribe('system/responses')

/* Execute a Redis-Lua script that will be used to populate past response stats that this Stats Manager missed */
{
  const scriptFilePath = path.resolve(__dirname, '../db', 'get-responses-from-timestamp.lua')
  fs.readFile(scriptFilePath, 'utf-8', function fileRead (error, content) {
    /* TODO: Proper error handler */
    if (error) {
      log(`Unable to read file content from file "${scriptFilePath}": ${error instanceof Error ? error.stack : error}`)
      return
    }

    shavaluator.add('getResponsesFromTimestamp', content)

    const timestamp = Date.now() - config.manager.stats.oldestStatsTimestamp
    shavaluator.exec('getResponsesFromTimestamp', [], [timestamp], function onResult (error, responses) {
      /* TODO: Proper error handler */
      if (error) {
        log(`Unable to execute Redis-Lua script "getResponsesFromTimestamp": ${error instanceof Error ? error.stack : error}`)
        return
      }

      if (!(responses instanceof Array)) {
        log(`Returned result from Redis-Lua script "getResponsesFromTimestamp" must be an {array} but is {${typeof responses}} ${utils.toString(responses)}`)
        return
      }

      responses.forEach(recordResponseStats)
    })
  })
}

/* Binds common stats getters to specific client socket emits */
function initStats (socketIo) {
  socketIo.on('connection', function onSocketConnect (socket) {
    /* Goes through 'responseStats' and returns an aggregate stats results from 'Date.now()' till 'timestamp' */
    function getServiceTypeResponseStatsFromTimestamp (serviceType, timestamp) {
      /*
        TODO: if the requested stats 'timestamp' is "older" then the ones we've got from 'config.manager.stats.oldestStatsTimestamp'
              we'll need to take the "older" stats directly from the DB using shavaluator.add('getResponsesFromTimestamp', content)
      */

      const time = Math.floor(timestamp / 1000)

      let stats = {
        total: 0,
        duration: {
          min: undefined,
          max: undefined,
          average: undefined
        }
      }
      let durations = []

      Object.keys(responseStats[serviceType] || {}).forEach(function collectStatsFromTime (statTime) {
        if (statTime >= time) {
          stats.total += responseStats[serviceType][statTime].total
          durations = durations.concat(responseStats[serviceType][statTime].durations)
        }
      })

      if (durations.length) {
        stats.duration.max = durations.reduce((max, duration) => Math.max(max, duration))
        stats.duration.min = durations.reduce((min, duration) => Math.min(min, duration))
        stats.duration.average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      }

      return stats
    }

    /**/
    function getSegregatedServiceTypeResponseStatsFromTimestamp (serviceType, timestamp) {
      /*
        TODO: if the requested stats 'timestamp' is "older" then the ones we've got from 'config.manager.stats.oldestStatsTimestamp'
              we'll need to take the "older" stats directly from the DB using shavaluator.add('getResponsesFromTimestamp', content)
      */

      const time = Math.floor(timestamp / 1000)

      let stats = {}

      Object.keys(responseStats[serviceType] || {}).forEach(function collectStatsFromTime (statTime) {
        if (statTime >= time) {
          stats[statTime] = responseStats[serviceType][statTime]
        }
      })

      return stats
    }

    /* Expose the internal stats getter in its general form and a custom (hopefully) more common 'all' form */

    socket.on('getServiceTypeResponseStatsFromTimestamp', function onRequest (args) {
      if (!args ||
          typeof args !== 'object'
      ) {
        return
      }

      socket.emit('getServiceTypeResponseStatsFromTimestamp', {
        requestId: args.requestId,
        data: getServiceTypeResponseStatsFromTimestamp(args.serviceType, args.timestamp)
      })
    })

    socket.on('getResponseStatsFromTimestamp', function onRequest (args) {
      if (!args ||
          typeof args !== 'object'
      ) {
        return
      }

      socket.emit('getResponseStatsFromTimestamp', {
        requestId: args.requestId,
        data: getServiceTypeResponseStatsFromTimestamp('all', args.timestamp)
      })
    })

    socket.on('getServiceTypeSegregatedResponseStatsFromTimestamp', function onRequest (args) {
      if (!args ||
          typeof args !== 'object'
      ) {
        return
      }

      socket.emit('getServiceTypeSegregatedResponseStatsFromTimestamp', {
        requestId: args.requestId,
        data: getSegregatedServiceTypeResponseStatsFromTimestamp(args.serviceType, args.timestamp)
      })
    })

    socket.on('getSegregatedResponseStatsFromTimestamp', function onRequest (args) {
      if (!args ||
          typeof args !== 'object'
      ) {
        return
      }

      socket.emit('getSegregatedResponseStatsFromTimestamp', {
        requestId: args.requestId,
        data: getSegregatedServiceTypeResponseStatsFromTimestamp('all', args.timestamp)
      })
    })
  })
}

module.exports = initStats
