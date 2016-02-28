'use strict'

const path = require('path')
const express = require('express')
const router = express.Router()
const config = require('custom/config')

/* Service indentation based on its location */
const serviceType = path.basename(__dirname)

router.get(`${config.services[serviceType].location}/:number`, function getPrimeNumberRequest (req, res, next) {
  /* TODO: Validate positive integer */
  const number = req.params.number || 1

  function isPrimeNumber (number) {
    /* TODO: validate positive integer */
    for (let i = 2; i <= Math.ceil(number / 2); i++) {
      if (!(number % i)) {
        return false
      }
    }

    return true
  }

  /* The purpose of this service is to be inefficient! */
  let totalFoundPrimes = 0
  let result = 1
  while (totalFoundPrimes < number) {
    if (isPrimeNumber(++result)) {
      totalFoundPrimes++
    }
  }

  res.json({
    error: undefined,
    result: result
  })
  next()
})

module.exports = router
