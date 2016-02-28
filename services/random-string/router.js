'use strict'

const path = require('path')
const express = require('express')
const router = express.Router()
const config = require('custom/config')

/* Service indentation based on its location */
const serviceType = path.basename(__dirname)

router.get(config.services[serviceType].location, function getRandomString (req, res, next) {
  console.log('getRandomString()')

  /* Dummy show calculation loading */
  let string = ''
  {
    let i = 0
    while (i++ < 10000000) {
      const p = Math.random() + Math.random() + Math.random() + Math.random() + Math.random()
      string = 'p = ' + p
    }
  }

  res.json({
    error: undefined,
    result: string
  })
  next()
})

module.exports = router
