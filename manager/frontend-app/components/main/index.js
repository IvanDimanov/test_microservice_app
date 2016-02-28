'use strict'

/* Load general App designs */
require('./index.scss')

import React from 'react'
import { render } from 'react-dom'
import { Router, Route, browserHistory, Redirect } from 'react-router'

import TopMenu from '../top-menu'
import InstancesTypesStats from '../instances-types-stats'
import GroupStats from '../group-stats'
import NotFound from '../not-found'

const App = React.createClass({
  render () {
    return (
      <div>
        <TopMenu />
        <hr />
        {this.props.children}
      </div>
    )
  }
})

render((
  <Router history={browserHistory}>
    <Redirect from='/' to='/instances-types-stats' />
    <Route path='/' component={App}>
      <Route path='instances-types-stats' component={InstancesTypesStats} />
      <Route path='group-stats' component={GroupStats} />
      <Route path='*' component={NotFound} />
    </Route>
  </Router>
), document.getElementById('app'))
