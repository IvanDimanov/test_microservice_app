'use strict'

const http = require('http')
const path = require('path')
const express = require('express')
const router = express.Router()
const config = require('custom/config')
const utils = require('custom/utils')

const log = utils.log // eslint-disable-line no-unused-vars
const toString = utils.toString
const getInstance = utils.getInstance
const isInteger = utils.isInteger
const JSON_parse = utils.JSON_parse

/* Service indentation based on its location */
const serviceType = path.basename(__dirname)

/* Common gateway of requesting data from other (micro) Services */
function getRequest (uri) {
  return new Promise(function (resolve, reject) {
    const url = `http://localhost/api${uri}`
    http.get(url, (response) => {
      let completeData = ''

      response.on('data', (data) => {
        completeData += data
      })

      /* Return converted Buffer to String */
      response.on('end', () => resolve(toString(completeData)))

      response.on('error', (error) => reject(`Unable to handle Response to "${url}": ${toString(error)}`))
    })
    .on('error', (error) => reject(`Unable to handle Request to "${url}": ${toString(error)}`))
  })
}

function getPrimeNumber (number) {
  return getRequest(`${config.services['prime-number'].location}/${number}`)
}

function getFibonacciNumber (number) {
  return getRequest(`${config.services['fibonacci-number'].location}/${number}`)
}

router.get(`${config.services[serviceType].location}/:number`, function getComboNumberRequest (req, res, next) {
  const number = req.params.number || 1

  if (!isInteger(number) ||
    number < 1
  ) {
    res.json({
      error: `Last URI "number" must be a positive {Integer} but same is ${getInstance(number)} ${toString(number)}`
    })
    return
  }

  Promise.all([
    getPrimeNumber(number),
    getFibonacciNumber(number)
  ])
  .then((responses) => {
    res.json({
      result: {
        'prime-number': JSON_parse(responses[0]) || {},
        'fibonacci-number': JSON_parse(responses[1]) || {}
      }
    })
  })

  .catch((error) => {
    res.json({error})
  })

  /* Release the control flow to the main Express server */
  .then(next)
})

module.exports = router
