/* This module exports API for setting nginx properties and generating a complete config file content */
'use strict'

const fs = require('fs')
const path = require('path')
const validator = require('validator')
const utils = require('custom/utils')

/* Used for debug only */
const log = utils.log // eslint-disable-line no-unused-vars

const exportApi = {}
;(function setExportApi () {
  /* Handles Monitor HTTP access location address */
  {
    const monitorAddress = {
      ip: '127.0.0.1',
      port: 3000
    }

    exportApi.setMonitorAddress = function setMonitorAddress (address) {
      return new Promise(function (resolve, reject) {
        if (!address ||
            typeof address !== 'object'
        ) {
          reject(new TypeError(`1st argument "address" must be {object} "address" = {${typeof address}} "${utils.toString(address)}"`))
          return
        }

        if (!validator.isIP(address.ip)) {
          reject(new TypeError(`1st argument "address" have invalid property {IP} "address.ip" = {${typeof address.ip}} "${utils.toString(address.ip)}"`))
          return
        }

        if (!validator.isInt(`${address.port}`, {min: 0})) {
          reject(new TypeError(`1st argument "address" have invalid property {port} "address.port" = {${typeof address.port}} "${utils.toString(address.port)}"`))
          return
        }

        monitorAddress.ip = address.ip
        monitorAddress.port = address.port

        resolve(utils.clone(monitorAddress))
      })
    }

    exportApi.getMonitorAddress = function getMonitorAddress () {
      return Promise.resolve(utils.clone(monitorAddress))
    }
  }

  /*
    Handles the main path from which serving will took place and
    keeping 'mainFolderPath' private for all external functions
  */
  {
    let mainFolderPath = './'
    exportApi.setMainFolderPath = function setMainFolderPath (path) {
      return new Promise(function (resolve, reject) {
        fs.stat(path, function isPathToDirectory (error, stats) {
          if (error) {
            reject(new Error(`Unable to get File System stats for path "${path}": ${error}`))
            return
          }

          if (!stats.isDirectory()) {
            reject(new TypeError(`1st argument "path" must be a path to Directory but "${path}" is not`))
            return
          }

          resolve(mainFolderPath = path)
        })
      })
    }

    exportApi.getMainFolderPath = function getMainFolderPath () {
      return Promise.resolve(mainFolderPath)
    }
  }

  /* Covers all needs for setting Load Balancers between different servers */
  {
    const loadBalancers = {}

    /*
      'externalLocation' is the URI any user can access to reach the Load Balancer, while
      'serviceLocation' is the URI that each service instance will be called after connection balancing.
    */
    exportApi.createLoadBalancer = function createLoadBalancer (name, externalLocation, serviceLocation, type) {
      return new Promise(function (resolve, reject) {
        const nameRegExp = /^[a-zA-Z0-9-]+$/
        if (typeof name !== 'string' ||
            !nameRegExp.test(name)
        ) {
          reject(new TypeError(`1st argument "name" must be {String} and match Regular Expresion "${nameRegExp}" but same is "${name}"`))
          return
        }

        if (loadBalancers[name] &&
            typeof loadBalancers[name] === 'object'
        ) {
          reject(new Error(`Duplicate Error: Load balancer with name "${name}" already exists`))
          return
        }

        const locationRegExp = /^(\/[^\/]*)+$/
        if (typeof externalLocation !== 'string' ||
            !locationRegExp.test(externalLocation)
        ) {
          reject(new TypeError(`2nd argument "externalLocation" must be {String} and match Regular Expresion "${locationRegExp}" but same is "${externalLocation}"`))
          return
        }

        const matchingName = Object.keys(loadBalancers).find((name) => loadBalancers[name].externalLocation === externalLocation)
        if (typeof matchingName === 'string') {
          reject(new TypeError(`2nd argument "externalLocation" must be uniqe between all Load Balancers but Load Balancer "${matchingName}" have the same Externa lLocation "${loadBalancers[matchingName].externalLocation}"`))
          return
        }

        if (typeof serviceLocation !== 'string' ||
            !locationRegExp.test(serviceLocation)
        ) {
          reject(new TypeError(`3rd argument "serviceLocation" must be {String} and match Regular Expresion "${locationRegExp}" but same is "${serviceLocation}"`))
          return
        }

        const validTypes = ['least_conn', 'ip_hash']
        if (type &&
          !~validTypes.indexOf(type)
        ) {
          reject(new TypeError(`4th argument "type", is optional and defaults to "round-robin" but if sent, it must be one of ["${validTypes.join('", "')}"] but same is "${type}"`))
          return
        }

        if (type === undefined) {
          type = 'round_robin'
        }

        loadBalancers[name] = {
          name,
          externalLocation,
          serviceLocation,
          type,
          servers: []
        }
        resolve(utils.clone(loadBalancers[name]))
      })
    }

    exportApi.addServerAddressToLoadBalancer = function addServerAddressToLoadBalancer (name, address) {
      return new Promise(function (resolve, reject) {
        if (!loadBalancers[name] ||
            typeof loadBalancers[name] !== 'object'
        ) {
          reject(new Error(`Load balancer with name "${name}" do not exist`))
          return
        }

        const addressParts = `${address}`.split(':')
        const ip = addressParts[0]
        const port = addressParts[1] * 1 || 80

        if (!validator.isFQDN(address) &&
            (
              !validator.isIP(ip) ||
              !validator.isInt(`${port}`, {min: 0})
            )
        ) {
          reject(new TypeError(`1st argument "address" must be a valid domain name or valid IPv4, IPv6 but same is "${address}"`))
          return
        }

        if (~loadBalancers[name].servers.indexOf(address)) {
          reject(new Error(`Duplicate Error: Load balancer with name "${name}" already have server with address "${address}"`))
          return
        }

        loadBalancers[name].servers.push(address)
        resolve(utils.clone(loadBalancers[name]))
      })
    }

    exportApi.removeServerAddressFromLoadBalancer = function removeServerAddressFromLoadBalancer (name, address) {
      return new Promise(function (resolve, reject) {
        if (!loadBalancers[name] ||
            typeof loadBalancers[name] !== 'object'
        ) {
          reject(new Error(`Load balancer with name "${name}" do not exist`))
          return
        }

        if (!~loadBalancers[name].servers.indexOf(address)) {
          reject(new Error(`Load balancer with name "${name}" do not have server with address "${address}"`))
          return
        }

        loadBalancers[name].servers.splice(loadBalancers[name].servers.indexOf(address), 1)
        resolve(utils.clone(loadBalancers[name]))
      })
    }

    exportApi.getAllLoadBalancers = function getAllLoadBalancers () {
      return Promise.resolve(utils.clone(loadBalancers))
    }
  }

  /* Uses all already saved nginx properties to generate complete config file content */
  exportApi.getFullTemplate = function getFullTemplate () {
    return Promise.all([
      exportApi.getMainFolderPath(),
      exportApi.getAllLoadBalancers(),
      exportApi.getMonitorAddress()
    ])
    .then(function combineAllValuesInTemplate (values) {
      const mainFolderPath = values[0]
      const loadBalancers = values[1]
      const monitorAddress = values[2]

      function getLoadBalancerServersTemplate (loadBalancer) {
        return `
  upstream ${loadBalancer.name} {
    ${loadBalancer.type !== 'round_robin' ? `${loadBalancer.type};` : ''}
  ${loadBalancer.servers.reduce((serversConfig, address) => `${serversConfig}  server ${address};
  `, '')}}
`
      }

      function getLoadBalancerLocationTemplate (loadBalancer) {
        return `
    location ${loadBalancer.externalLocation} {
      proxy_pass http://${loadBalancer.name}${loadBalancer.serviceLocation};
    }
`
      }

      return `
# Defaults to number of CPUs
worker_processes auto;

events {
  # Total active connections per worker; correlate to total number of open files
  worker_connections 512;
}

http {
  # Return common MIME types for files such as CSS and JS
  include ${path.resolve(__dirname, 'mime.types')};

  # Used for WebSocket connection maintenance
  map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
  }

  # List of servers that will handle the (micro) service
  ${Object.keys(loadBalancers).reduce((balancersConfig, name) => `${balancersConfig}  ${getLoadBalancerServersTemplate(loadBalancers[name])}`, '')}

  # List of servers that will handle monitor app responses
  upstream managerServers {
    least_conn;
    server ${monitorAddress.ip}:${monitorAddress.port};
  }

  # Main localhost:80 traffic router
  server {
    root ${mainFolderPath};

    listen 80;
    server_name localhostServer;

    # Redirect to load-balancer
    ${Object.keys(loadBalancers).reduce((balancersConfig, name) => `${balancersConfig}  ${getLoadBalancerLocationTemplate(loadBalancers[name])}`, '')}

    # Main SPA page
    location /manager {
      try_files /manager/frontend-app/public/index.html $uri $uri/;
    }

    # Load the static Socket.io JS file from the Socket.io Sever
    location ~ ^/manager/frontend-app/public/socket.io(.*)$ {
      rewrite /manager/frontend-app/public(.*) $1 break;
      proxy_pass       http://managerServers;
      proxy_redirect   off;
      proxy_set_header Host $host;
    }

    # Static/public Manager files (JS, CSS)
    location ~ ^/manager/frontend-app/public/(.*)$ {
      try_files $uri $uri/;
    }

    # Most important Socket handler that will feed the Manager SPA page with latest Server updates
    location /manager/socket.io {
      rewrite /manager(.*) $1 break;
      proxy_pass http://managerServers;
      proxy_redirect off;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_set_header Host $host;
    }
  }
}`
    })
  }
})()

module.exports = exportApi
