/* global io */
'use strict'

/* Let all modules use the Backend connection */
const socket = io({
  /* Request "manager" specific Socket.io resource, not the default one '/socket.io' */
  path: '/manager/socket.io',

  /* 'polling' is set as 1st by default but we're much more interested in 'websocket' */
  transports: ['websocket', 'polling']
})

/* Maximum amount of time we gonna wait for a request to be responded from the Backend */
const maxResponseTime = 20 * 60 * 10000

/* Tells whenever we can use the established socket connection */
const socketOnReady = new Promise(function (resolve, reject) {
  const maxConnectionTimeout = 60 * 60 * 1000
  const timeout = setTimeout(() => reject(), maxConnectionTimeout)

  socket.on('connect', function socketConnected () {
    clearTimeout(timeout)
    resolve()
  })
})

/*
  Uses a unique 'requestId' parameter to turn the pub/sub socket mechanics into request/response one
  then will request a resource of 'requestName' with specific 'params' and
  will serve the result on fulfillment
*/
function requestData (requestName, params) {
  return socketOnReady
    .then(() => new Promise(function (resolve, reject) {
      let requestId = Date.now() + Math.random()
      socket.emit(requestName, Object.assign({requestId}, params))

      function emitReceivedStats (response) {
        if (!response ||
            typeof response !== 'object' ||
            response.requestId !== requestId
        ) {
          return
        }

        socket.off(requestName, emitReceivedStats)
        clearTimeout(timeoutTimer)

        if (response.error) {
          reject(response.error)
        } else {
          resolve(response.data)
        }
      }

      socket.on(requestName, emitReceivedStats)

      const timeoutTimer = setTimeout(() => {
        socket.off(requestName, emitReceivedStats)
        reject(new Error(`Maximum timeout of ${maxResponseTime} [milliseconds] spent but no response was received`))
      }, maxResponseTime)
    })
  )
}

socket.requestData = requestData
socket.getMaxResponseTime = () => maxResponseTime

export default socket
