'use strict'

require('./index.scss')

import React from 'react'
import {log, toString, getInstace} from 'custom/utils'
import statsStore from '../../stores/stats'
import instanceStore from '../../stores/instance'

import InstancesNumberManager from '../instances-number-manager'

import charts from './charts'
const {createShiftingBarChart, createShiftingLineChart} = charts

const InstancesTypesStats = React.createClass({
  getInitialState () {
    return {
      instancesTypes: {}
    }
  },

  createCharts (type) {
    const periods = 30
    const tickerTimeout = statsStore.emitter.getTickerTimeout()
    const endTimestamp = Date.now()
    const startTimestamp = endTimestamp - periods * tickerTimeout

    /* 0 values cannot be drawn in a chart */
    const minValue = 1

    const that = this

    statsStore.getServiceTypeSegregatedResponseStatsFromTimestamp({
      serviceType: type,
      timestamp: startTimestamp
    })
    .then((segregatedStats) => {
      ;(function createBarChart () {
        /* Strip most of the stats properties while leaving only the data used for the Bar Chart */
        const dataSet = Array.from({length: periods})
          .map((value, index) => {
            const time = Math.floor((startTimestamp + index * tickerTimeout) / 1000)
            return segregatedStats[time] && typeof segregatedStats[time] === 'object' ? segregatedStats[time].total : minValue
          })

        /* Create a Bar Chart in a predefined placeholder w/ the calculated states data */
        const barChart = createShiftingBarChart({
          uiSelector: `.instanceType-${type} .stats-total`,
          width: 1000,
          height: 300,
          maxValue: 400,
          duration: tickerTimeout * 0.98, /* Keep the animation slightly faster in order to prevent overlapping insertion of "not animated" data */
          maxVisibleBars: periods - 2     /* These 2 additional periods needs to be inserted into the 'dataSet' but not set as "visible" coz they'll be on the most left and most right side of the chart */
        })

        /* Subscribe the Chart for all Stats Updates that may come in future */
        barChart.statsUpdater = function statsUpdater (stats) {
          if (!stats ||
              typeof stats !== 'object'
          ) {
            log(new TypeError(`1st argument "stats" of type "${type}" must be {Object} but same is {${getInstace(stats)}} ${toString(stats)}`))
            return
          }

          barChart.addOneDataItem(stats.total || minValue)
          barChart.draw()
        }

        /* Set the initial data and kickoff with the drawing animation */
        /* NOTE: We gonna subscribe for new stats data only when we've finished animating the current one
                 in order to prevent overlapping insertion of "not animated" data
        */
        barChart.setData(dataSet)
        barChart.draw(() => {
          if (barChart.isChartDestroyed()) {
            return
          }
          statsStore.emitter.on(`${type}/responseStats`, barChart.statsUpdater)
        })

        /* Register the newly created chart in the state so all other processes can have access to it */
        const instancesTypes = that.state.instancesTypes
        instancesTypes[type].barChart = barChart
        that.setState({instancesTypes})
      })()

      ;(function createLineChart () {
        function getAverageDuasion (stats) {
          if (!stats ||
              typeof stats !== 'object' ||
              !(stats.durations instanceof Array)
          ) {
            return minValue
          }

          const durationsSum = stats.durations
            .reduce((sum, duration) => sum + duration)

          return durationsSum / stats.durations.length
        }

        /* Strip most of the stats properties while leaving only the data used for the Line Chart */
        const dataSet = Array.from({length: periods})
          .map((value, index) => {
            const time = Math.floor((startTimestamp + index * tickerTimeout) / 1000)
            return getAverageDuasion(segregatedStats[time])
          })

        /* Create a Line Chart in a predefined placeholder w/ the calculated states data */
        const lineChart = createShiftingLineChart({
          uiSelector: `.instanceType-${type} .stats-duration`,
          width: 1000,
          customScaleWidth: 1000 + periods * 3.5,
          height: 280,
          maxValue: 12000,
          duration: tickerTimeout * 0.98, /* Keep the animation slightly faster in order to prevent overlapping insertion of "not animated" data */
          maxVisibleLines: periods,
          defaultStyle: {
            strokeColor: '#F0B',
            strokeWidth: 3
          }
        })

        /* Subscribe the Chart for all Stats Updates that may come in future */
        lineChart.statsUpdater = function statsUpdater (stats) {
          if (!stats ||
              typeof stats !== 'object'
          ) {
            log(new TypeError(`1st argument "stats" of type "${type}" must be {Object} but same is {${getInstace(stats)}} ${toString(stats)}`))
            return
          }

          const averageDuasion = (stats.duration || {average: 0}).average || minValue
          lineChart.addOneDataItem(averageDuasion)
          lineChart.draw()
        }

        /* Set the initial data and kickoff with the drawing animation */
        /* NOTE: We gonna subscribe for new stats data only when we've finished animating the current one
                 in order to prevent overlapping insertion of "not animated" data
        */
        lineChart.setData(dataSet)
        lineChart.draw(() => {
          if (lineChart.isChartDestroyed()) {
            return
          }
          statsStore.emitter.on(`${type}/responseStats`, lineChart.statsUpdater)
        })

        /* Register the newly created chart in the state so all other processes can have access to it */
        const instancesTypes = that.state.instancesTypes
        instancesTypes[type].lineChart = lineChart
        that.setState({instancesTypes})
      })()
    })
  },

  componentDidMount () {
    instanceStore.getAllInstancesTypes()
      .then((types) => {
        types
          /* Convert all types from {String}s into {Object}s */
          .map((type) => ({type}))

          /* Assign Instance Type objects into the local State */
          .map((instanceType) => {
            const instancesTypes = this.state.instancesTypes
            instancesTypes[instanceType.type] = instanceType
            this.setState({instancesTypes})

            return instanceType
          })

          .map((instanceType) => {
            this.createCharts(instanceType.type)
            return instanceType
          })

          /* Set all "Instance Number Manager" fields as initially hidden */
          .map((instanceType) => {
            const instancesTypes = this.state.instancesTypes
            Object.assign(instancesTypes[instanceType.type], {
              isManagerVisible: false
            })
            this.setState({instancesTypes})
          })
      })

      .catch((error) => log(`Error: Unable to get all Runing Service Instances: ${toString(error)}`))
  },

  componentWillUnmount () {
    /* Unbind from all stats events we take data from */
    const instancesTypes = this.state.instancesTypes
    Object.keys(instancesTypes)
      .forEach((type) => {
        const barChart = instancesTypes[type].barChart
        statsStore.emitter.off(`${type}/responseStats`, barChart.statsUpdater)
        barChart.destroy()

        const lineChart = instancesTypes[type].lineChart
        statsStore.emitter.off(`${type}/responseStats`, lineChart.statsUpdater)
        lineChart.destroy()
      })
  },

  toggleManagerVisibility (type) {
    const instancesTypes = this.state.instancesTypes
    Object.assign(instancesTypes[type], {
      isManagerVisible: !instancesTypes[type].isManagerVisible
    })
    this.setState({instancesTypes})
  },

  render () {
    const instancesTypes = this.state.instancesTypes
    return (
      <div className='instances-types-stats'>
        {
          Object.keys(instancesTypes)
            .map((type) => {
              return (<div key={type} className={`instanceType instanceType-${type}`}>
                <strong>
                  Service Type:
                  <em>{type}</em>
                  <button className='toggle-manager' onClick={() => this.toggleManagerVisibility(type)}>+</button>
                  {instancesTypes[type].isManagerVisible &&
                    <InstancesNumberManager type={type} />
                  }
                </strong>
                <br />
                <svg className='stats stats-duration'></svg>
                <svg className='stats stats-total'></svg>
              </div>)
            })
        }
      </div>
    )
  }
})

export default InstancesTypesStats
