'use strict'

require('./index.scss')

import React from 'react'
import { Link } from 'react-router'

const TopMenu = React.createClass({
  render () {
    return (
      <nav>
        <Link to='instances-types-stats' activeClassName='active'>Instances Types Stats</Link>
        |
        <Link to='group-stats' activeClassName='active'>Group Services Stats</Link>
      </nav>
    )
  }
})

export default TopMenu
