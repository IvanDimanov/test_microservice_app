/* global sigma */
'use strict'

require('./index.scss')

import React from 'react'
import instanceStore from '../../stores/instance'
import statsStore from '../../stores/stats'
import {log, toString, getInstance} from 'custom/utils'

import InstancesNumberManager from '../instances-number-manager'

/* Return a HEX color scale where 0 is "green" and 100 is "red" */
function getColorFromPercentage (percentage) {
  if (typeof percentage !== 'number' ||
      percentage < 0 ||
      percentage > 100
  ) {
    throw new TypeError(`1st argument "percentage" must be a {Number} between [0, 100] (both included) but "percentage" is {${getInstance(percentage)}} ${toString(percentage)}`)
  }

  let R = Math.round((255 * percentage) / 100)
  let G = Math.round((255 * (100 - percentage)) / 100)

  R = R.toString(16)
  G = G.toString(16)

  R = R.length === 1 ? `0${R}` : R
  G = G.length === 1 ? `0${G}` : G

  return `#${R}${G}00`
}

const GroupStats = React.createClass({
  getInitialState () {
    return {
      chart: {},
      lastInstancesTypes: {},
      instancesTypesTimer: undefined,
      manager: {
        isVisible: false,
        marginTop: 0,
        marginLeft: 0
      }
    }
  },

  /*
    Uses a common Backend response for all running instanced
    in order to convert it in an aggregated form
    that will combine all instances of the same type.
    NOTE: Mostly used in a combination with 'this.createGraph'
  */
  convertToInstancesTypes (instances) {
    return instances
      .reduce((instancesTypes, instance) => {
        const {type} = instance
        if (!instancesTypes[type]) {
          instancesTypes[type] = []
        }
        instancesTypes[type].push(instance)
        return instancesTypes
      }, {})
  },

  /*
    Use an aggregated form of Instance Types to generate main Graph
    with all of his nodes and roots.
    NOTE: Expect 'instancesTypes' to have the following form:

      const instancesTypes = {
        'prime-number': [{
          name: 'prime-number-1'
        }, {
          name: 'prime-number-2'
        }, {
          name: 'prime-number-3'
        }],

        'fibonacci-number': [{
          name: 'fibonacci-number-1'
        }, {
          name: 'fibonacci-number-2'
        }, {
          name: 'fibonacci-number-3'
        }, {
          name: 'fibonacci-number-4'
        }],

        'random-string': [{
          name: 'random-string-1'
        }, {
          name: 'random-string-2'
        }]
      }
  */
  createGraph (instancesTypes) {
    ;(function validateInput () {
      if (!instancesTypes ||
          typeof instancesTypes !== 'object' ||
          !Object.keys(instancesTypes).length
      ) {
        throw new TypeError(`1st argument "instancesTypes" must be a non-empty {Object} but same is {${getInstance(instancesTypes)}} ${toString(instancesTypes)}`)
      }

      Object.keys(instancesTypes)
        .forEach((type, index) => {
          const instances = instancesTypes[type]

          if (!(instances instanceof Array) ||
              !instances.length
          ) {
            throw new TypeError(`1st argument "instancesTypes['${type}']" must be a non-empty {Array} but same is {${getInstance(instances)}} ${toString(instances)}`)
          }

          instances
            .forEach((instance, index) => {
              if (!instance ||
                  typeof instance !== 'object'
              ) {
                throw new TypeError(`1st argument "instancesTypes['${type}'][${index}]" must be an {Object} but same is {${getInstance(instance)}} ${toString(instance)}`)
              }

              if (!instance.name ||
                  typeof instance.name !== 'string'
              ) {
                throw new TypeError(`1st argument "instancesTypes['${type}'][${index}].name" must be a non-empty {String} but same is {${getInstance(instance.name)}} ${toString(instance.name)}`)
              }
            })
        })
    })()

    const that = this
    const graph = {
      nodes: [],
      edges: []
    }

    const typeNodeMinSize = 5
    const typeNodeMaxSize = 50
    const typeNodeMaxDurationAverage = 15 * 1000
    const typeNodeVerticalStep = 5

    const instanceNodeMinSize = 2
    const instanceMarginTop = 5
    const instanceMarginLeft = 5

    let groupMarginLeft = 0
    let firstTypeNode = {}
    let lastTypeNode = {}
    let lastEvenTypeNode = {}

    /*
      Main link to Manager module.
      NOTE: 'x' and 'y' coords depend on 'firstTypeNode', 'lastTypeNode', 'lastEvenTypeNode'
            so they'll be added later
    */
    graph.nodes.push({
      id: 'root',
      label: 'System Root',
      x: 0,
      y: 0,
      size: 7,
      color: '#666'
    })

    /* Add a Graph node for each Instance Root Type and each instance type */
    Object.keys(instancesTypes)
      .forEach((type, typeIndex, typesNames) => {
        const instances = instancesTypes[type]
        const typeRootId = `instance-group-type-${type}`

        const node = {
          id: typeRootId,
          label: `Group: ${type}`,
          type,
          x: groupMarginLeft + instanceMarginLeft * (instances.length - (typeIndex % 2 ? 3 : 1)) / 2,
          y: instanceMarginTop * (typeIndex % 2 ? typeNodeVerticalStep : 2),
          size: typeNodeMinSize,
          color: '#666'
        }

        graph.nodes.push(node)

        if (typeIndex === 0) {
          firstTypeNode = node
        } else if (typeIndex === typesNames.length - 1) {
          lastTypeNode = node
        } else if (typeIndex % 2) {
          lastEvenTypeNode = node
        }

        /* All Type-roots are directly connected to the Manager root */
        graph.edges.push({
          id: `edge-${typeRootId}-root`,
          source: typeRootId,
          target: 'root',
          size: 1,
          color: '#333'
        })

        /* Position each Instances of the same type close to their Service Type node */
        instances
          .forEach((instance, index) => {
            const id = `instance-${type}-${instance.name}`

            graph.nodes.push({
              id,
              label: instance.name,
              x: groupMarginLeft + (typeIndex % 2 ? index - 1 : index) * instanceMarginLeft,
              y: instanceMarginTop * (typeIndex % 2 ? typeNodeVerticalStep + 1 : 1),
              size: instanceNodeMinSize,
              color: '#666'
            })

            graph.edges.push({
              id: `edge-${id}-${typeRootId}`,
              source: id,
              target: typeRootId,
              size: 1,
              color: '#CCC'
            })
          })

        /*
          Keep track of how much the next Service Type group (type root + instances) must shift so
          all groups sill be correctly visible
        */
        groupMarginLeft += instances.length * instanceMarginLeft
      })

    /* Reposition the main Manager Root node in the center of all Service Type nodes */
    graph.nodes[0].x = (lastTypeNode.x - firstTypeNode.x) / 2 + firstTypeNode.x
    graph.nodes[0].y = (lastEvenTypeNode.y - firstTypeNode.y) / 2 + firstTypeNode.y

    const Sigma = sigma   /* Just because constructors should always be with Capital letter */
    const chart = new Sigma({
      graph: graph,
      container: document.getElementById('graph-container'),
      settings: {
        labelThreshold: 4
      }
    })

    /*
      Subscribe all nodes for stats updates so
      each node size will respond to the total amount of request the node resolved and
      each node color will respond to the average time duration a response took to be resolved
    */
    const statsTickerTimeout = statsStore.emitter.getTickerTimeout()
    chart.statsUpdaters = {}
    Object.keys(instancesTypes)
      .forEach(function bindToTypeUpdates (type, typeIndex) {
        const typeRootId = `instance-group-type-${type}`

        chart.statsUpdaters[type] = function statsUpdater (stats) {
          if (!stats ||
              typeof stats !== 'object'
          ) {
            log(new TypeError(`1st argument "stats" of type "${type}" must be {Object} but same is {${getInstance(stats)}} ${toString(stats)}`))
            return
          }

          /* Find the exact node that this stats relays to */
          that.state.chart.graph.nodes()
            .some((node) => {
              if (node.id !== typeRootId) {
                return
              }

              let durationAverage = (stats.duration || {}).average || 0
              durationAverage = Math.min(durationAverage, typeNodeMaxDurationAverage)

              /* As higher the average duration - as more red the node goes */
              node.color = getColorFromPercentage(durationAverage / typeNodeMaxDurationAverage * 100)

              /* As more responses a Service Type resolves - as bigger its size gets */
              node.size = Math.min(Math.max(stats.total / 5, typeNodeMinSize), typeNodeMaxSize)

              chart.refresh()

              return true
            })
        }

        /* Set initial values for all Service Type Roots by using the last stats ticker call timeout */
        statsStore.getServiceTypeResponseStatsFromTimestamp({
          serviceType: type,
          timestamp: Date.now() - statsTickerTimeout
        })
        .then(chart.statsUpdaters[type])

        /* Keep track of all stat updates for each Instance Service Type */
        statsStore.emitter.on(`${type}/responseStats`, chart.statsUpdaters[type])
      })

    /*
      Present a specific Instance Number Manager for each clicked node.
      The manager will be positioned just below the clicked node and
      can e used to manipulate the total number of running instances.
    */
    chart.bind('clickNode', (event) => {
      const node = event.data.node

      if (!node.type) {
        this.setState({
          manager: {
            isVisible: false
          }
        })

        log('Current Graph version can manages only Root Type Instances')
        return
      }

      let x = 0
      let y = 0

      /*
        Every time a sigma chart is been destroyed and recreated it'll generate new 'id' property.
        In order to keep track of the click 'node' coords - we'll find and use the current 'id' value.
      */
      const keysRegExp = /^renderer(\d+):[yx]{1}$/
      Object.keys(node)
        .some((key) => {
          const components = key.match(keysRegExp)
          if (components) {
            const id = components[1]
            x = node[`renderer${id}:x`]
            y = node[`renderer${id}:y`]

            return true
          }
        })

      /* Position the Instance Number Manager right below clicked node */
      this.setState({
        manager: {
          isVisible: true,
          type: node.type,
          marginTop: y + 20,  /* 20 is the size of the node title line which will skip so it'll remain visible even after the Manager is presented */
          marginLeft: x
        }
      })
    })

    /* Hide the Number Manager on clicking outside a node */
    chart.bind('clickStage', () => {
      this.setState({
        manager: {
          isVisible: false
        }
      })
    })

    /*
      Let the all component functions have access to the chart so
      they can destroy it or alter its data
    */
    this.setState({chart})
  },

  destroyGraph () {
    const statsUpdaters = this.state.chart.statsUpdaters
    Object.keys(statsUpdaters)
      .forEach((type) => {
        statsStore.emitter.off(`${type}/responseStats`, statsUpdaters[type])
      })

    this.state.chart.kill()
  },

  /*
    Checks every couple of seconds if the rendered Graph
    presents correctly all currently active instances.
  */
  syncActiveInstances () {
    let timer = this.state.instancesTypesTimer
    clearTimeout(timer)

    instanceStore
      .getAllInstances()

      /* Combine all Instances by a common type */
      .then(this.convertToInstancesTypes)

      .then((currentInstancesTypes) => {
        if (toString(currentInstancesTypes) === toString(this.state.lastInstancesTypes)) {
          return
        }

        /* Recreate the main Graph using the latest number of instances */
        this.destroyGraph()
        this.createGraph(currentInstancesTypes)
        this.setState({
          lastInstancesTypes: currentInstancesTypes
        })
      })

      .catch((error) => log(`Unable to sync with the Backend about latest active instance: ${toString(error)}`))

      .then(() => {
        /*
          Check for updates no more often then we get their stats
          because stats are important for each node presentation
        */
        timer = setTimeout(this.syncActiveInstances, statsStore.emitter.getTickerTimeout())
        this.setState({
          instancesTypesTimer: timer
        })
      })
  },

  componentDidMount () {
    /* Get all running instances from the Backend */
    instanceStore
      .getAllInstances()

      /* Combine all Instances by a common type */
      .then(this.convertToInstancesTypes)

      /* Record the initial Instances schema as latest in use */
      .then((lastInstancesTypes) => {
        this.setState({lastInstancesTypes})
        return lastInstancesTypes
      })

      /* Create the main Graph by converting all instances into nodes */
      .then(this.createGraph)

      /*
        Be sure that if there are newly added or removed instances
        this function will recreate them in the main Graph
      */
      .then(this.syncActiveInstances)

      .catch((error) => log(`Unable to create Grapf from all running Service instances: ${toString(error)}`))
  },

  componentWillUnmount () {
    this.destroyGraph()
    clearTimeout(this.state.instancesTypesTimer)
  },

  render () {
    const {manager} = this.state
    return (
      <div>
        <h3>All Connected Services</h3>
        {manager.isVisible &&
          <InstancesNumberManager type={manager.type} marginTop={manager.marginTop} marginLeft={manager.marginLeft} />
        }
        <div id='graph-container'></div>
      </div>
    )
  }
})

export default GroupStats
