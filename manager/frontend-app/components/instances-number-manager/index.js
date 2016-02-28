'use strict'

require('./index.scss')

import React from 'react'
import {log, toString, getInstance, isInteger} from 'custom/utils'
import instanceStore from '../../stores/instance'

/* TODO: Will fit nicely in a config */
const maxInstancesPerType = 20

const InstancesNumberManager = React.createClass({
  getInitialState () {
    return {
      totalInstances: 0,
      diff: 0,
      enableButtons: true
    }
  },

  updateTotalInstances () {
    const {type} = this.props
    return instanceStore.getTotalInstancesByType({type})
      .then((totalInstances) => {
        this.setState({totalInstances})
      })
      .catch((error) => {
        throw new Error(`Unable to load the total number of running "${type}" instances: ${toString(error)}`)
      })
  },

  componentWillMount () {
    this.updateTotalInstances()
  },

  /* Limit the adding of new instances so total running instances never be grater than 'maxInstancesPerType' */
  addInstance () {
    const {diff, totalInstances} = this.state
    this.setState({
      diff: Math.min(diff + 1, maxInstancesPerType - totalInstances)
    })
  },

  /* Limit the removal of existing instances so there could always be minimum of 1 instance per type */
  removeInstance () {
    const {diff, totalInstances} = this.state
    this.setState({
      diff: Math.max(diff - 1, 1 - totalInstances)
    })
  },

  /*
    Calculate how much in total instances the user wants to have and
    suggest the change to the Backend
  */
  setNewTotalInstances () {
    const {type} = this.props
    const {diff, totalInstances} = this.state

    if (!diff ||
        !isInteger(diff)
    ) {
      throw new RangeError(`Unable alter the total number of "${type}" instances by adding {${getInstance(diff)}} ${toString(diff)}`)
    }

    /*
      No need to spam the server.
      We'll enable them back once we have a response from the Backend.
    */
    this.setState({
      enableButtons: false
    })

    instanceStore.setTotalInstancesByType({
      type,
      newTotal: totalInstances + diff
    })
    .catch((error) => {
      throw new Error(`Unable alter the total number of "${type}" instances by adding ${toString(diff)}: ${toString(error)}`)
    })
    .then((message) => {
      /* Present the success message in a more "User friendly" component */
      log(message)

      this.updateTotalInstances()
      .then(() => {
        /* Let the user alter again his instances number */
        this.setState({
          diff: 0,
          enableButtons: true
        })
      })
    })
  },

  render () {
    const {totalInstances, diff, enableButtons} = this.state
    const {marginTop, marginLeft} = this.props
    return (
      <div className='instances-number-manager' style={{marginTop, marginLeft}}>
        <h4>Total instances</h4>
        <span className='count'>
          <strong>{totalInstances}</strong>
          {diff !== 0 &&
            <em className={diff > 0 ? 'add' : 'remove'}> {diff > 0 ? '+' : '-'} {Math.abs(diff)}</em>
          }
        </span>
        <button className='add' disabled={!enableButtons} onClick={this.addInstance}>/\</button>
        <button className='remove' disabled={!enableButtons} onClick={this.removeInstance}>\/</button>
        {diff !== 0 &&
          <button className='set' disabled={!enableButtons} onClick={this.setNewTotalInstances}>Set</button>
        }
      </div>
    )
  }
})

export default InstancesNumberManager
