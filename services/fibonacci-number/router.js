'use strict'

const path = require('path')
const express = require('express')
const router = express.Router()
const config = require('custom/config')

/* Service indentation based on its location */
const serviceType = path.basename(__dirname)

router.get(`${config.services[serviceType].location}/:number`, function getFibonacciNumberRequest (req, res, next) {
  /* TODO: Validate positive integer */
  const number = req.params.number || 1

  /* The purpose of this service is to be inefficient! */
  const fibonacciNumbers = [0, 1]
  while (fibonacciNumbers[number - 1] === undefined) {
    fibonacciNumbers.push(fibonacciNumbers[fibonacciNumbers.length - 1] + fibonacciNumbers[fibonacciNumbers.length - 2])
  }

  res.json({
    error: undefined,
    result: fibonacciNumbers[number - 1]
  })
  next()
})

module.exports = router
