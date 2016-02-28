/* global d3 */
'use strict'

require('d3/d3.min.js')

/*
  Returns an instance of UI Bar Chart presentation.
  Use the returned functions to manipulate chart data and when ready - call 'draw()'.
  Each configuration property of 'config' have its own validation so use those messages as a configuration description.
*/
function createShiftingBarChart (config) {
  /*
    'Object.prototype.toString' will do all safe checks for us and give the 'variable' constructor.
    Example:
      getInstance()                =>  "Undefined"
      getInstance(  undefined   )  =>  "Undefined"
      getInstance(     null     )  =>  "Null"
      getInstance(     true     )  =>  "Boolean"
      getInstance(      ''      )  =>  "String"
      getInstance(       1      )  =>  "Number"
      getInstance(      {}      )  =>  "Object"
      getInstance(      []      )  =>  "Array"
      getInstance(    Error     )  =>  "Function"
      getInstance( new Error()  )  =>  "Error"
      getInstance( new RegExp() )  =>  "RegExp"
  */
  function getInstance (variable) {
    return Object.prototype.toString.call(variable).replace('[object ', '').replace(']', '')
  }

  /* Input validation and setting default values */
  ;(function inputValidation () {
    var colorRegExp = /^#[0-9a-f]{3,6}$/i

    if (!config ||
        typeof config !== 'object'
    ) {
      config = {}
    }

    if (!config.uiSelector ||
        typeof config.uiSelector !== 'string'
    ) {
      throw new TypeError('1st argument {object} must have property {String} "uiSelector" but same is {' + getInstance(config.uiSelector) + '} ' + config.uiSelector)
    }

    if (!d3.select(config.uiSelector) ||
        !d3.select(config.uiSelector)[0] ||
        !d3.select(config.uiSelector)[0][0]
    ) {
      throw new TypeError('1st argument {object} must have property {String} "uiSelector" that matches existing DOM element but there is no match for selector "' + config.uiSelector + '"')
    }

    if (config.width === undefined) {
      config.width = 600
    }

    if (!config.width ||
        typeof config.width !== 'number' ||
        config.width < 0
    ) {
      throw new TypeError('1st argument {object}, if optional property "width" is set, it must be positive {Number} "width" but same is {' + getInstance(config.width) + '} ' + config.width)
    }

    if (config.height === undefined) {
      config.height = 400
    }

    if (!config.height ||
        typeof config.height !== 'number' ||
        config.height < 0
    ) {
      throw new TypeError('1st argument {object}, if optional property "height" is set, it must be positive {Number} "height" but same is {' + getInstance(config.height) + '} ' + config.height)
    }

    if (config.maxValue !== undefined &&
        typeof config.maxValue !== 'number'
    ) {
      throw new TypeError('1st argument {object}, if optional property "maxValue" is set, it must be {Number} "maxValue" but same is {' + getInstance(config.maxValue) + '} ' + config.maxValue)
    }

    if (config.duration === undefined) {
      config.duration = 5000
    }

    if (!config.duration ||
        typeof config.duration !== 'number' ||
        config.duration < 0 ||
        config.duration % 1
    ) {
      throw new TypeError('1st argument {object}, if optional property "duration" is set, it must be positive {Integer} "duration" but same is {' + getInstance(config.duration) + '} ' + config.duration)
    }

    if (config.maxVisibleBars === undefined) {
      config.maxVisibleBars = 5
    }

    if (!config.maxVisibleBars ||
        typeof config.maxVisibleBars !== 'number' ||
        config.maxVisibleBars < 0 ||
        config.maxVisibleBars % 1
    ) {
      throw new TypeError('1st argument {object}, if optional property "maxVisibleBars" is set, it must be positive {Integer} "maxVisibleBars" but same is {' + getInstance(config.maxVisibleBars) + '} ' + config.maxVisibleBars)
    }

    if (config.padding === undefined) {
      config.padding = 0.5
    }

    if (typeof config.padding !== 'number' ||
        config.padding < 0 ||
        config.padding > 1
    ) {
      throw new TypeError('1st argument {object}, if optional property "padding" is set, it must be {Float} [0; 1] (e.g. 0.5) "padding" but same is {' + getInstance(config.padding) + '} ' + config.padding)
    }

    if (config.defaultStyle === undefined) {
      config.defaultStyle = {}
    }

    if (!config.defaultStyle ||
        typeof config.defaultStyle !== 'object'
    ) {
      throw new TypeError('1st argument {object}, if optional property "defaultStyle" is set, it must be {JSON} object "defaultStyle" but same is {' + getInstance(config.defaultStyle) + '} ' + config.defaultStyle)
    }

    if (config.defaultStyle.strokeWidth === undefined) {
      config.defaultStyle.strokeWidth = 0
    }

    if (typeof config.defaultStyle.strokeWidth !== 'number' ||
        config.defaultStyle.strokeWidth < 0
    ) {
      throw new TypeError('1st argument {object}, if optional property "defaultStyle.strokeWidth" is set, it must be non-negative {Number} "defaultStyle.strokeWidth" but same is {' + getInstance(config.defaultStyle.strokeWidth) + '} ' + config.defaultStyle.strokeWidth)
    }

    if (config.defaultStyle.strokeColor === undefined) {
      config.defaultStyle.strokeColor = '#000'
    }

    if (!colorRegExp.test(config.defaultStyle.strokeColor)) {
      throw new TypeError('1st argument {object}, if optional property "defaultStyle.strokeColor" is set, it must match a {Color} regular expression "' + colorRegExp.toString() + '" but same is {' + getInstance(config.defaultStyle.strokeColor) + '} ' + config.defaultStyle.strokeColor)
    }

    if (config.defaultStyle.fillColor === undefined) {
      config.defaultStyle.fillColor = '#000'
    }

    if (!colorRegExp.test(config.defaultStyle.fillColor)) {
      throw new TypeError('1st argument {object}, if optional property "defaultStyle.fillColor" is set, it must match a {Color} regular expression "' + colorRegExp.toString() + '" but same is {' + getInstance(config.defaultStyle.fillColor) + '} ' + config.defaultStyle.fillColor)
    }

    if (config.dataSet === undefined) {
      config.dataSet = []
    }

    if (!(config.dataSet instanceof Array)) {
      throw new TypeError('1st argument {object}, if optional property "dataSet" is set, it must be an {Array} "dataSet" but same is {' + getInstance(config.dataSet) + '} ' + config.dataSet)
    }
  })()

  /*
    Tells whenever a 'destroy()' function is been called and
    if all components are removed
  */
  let isDestroyed = false

  /* We need 2 additional bars that will be covered either in the most left or the most right side of the chart */
  var range = config.maxVisibleBars + 2

  /* This margin will extend the chart inner group so the 2 additional bars can fit into */
  var margin = config.width / config.maxVisibleBars

  /* All width components of the internal group <g> element */
  var maxGroupWidth = config.width + 2 * margin
  var totalBarsWidth = 2 * (1 - config.padding) * range
  var totalPaddingsWidth = 2 * config.padding * (range - 1)

  /* Total width of a single bar and its padding */
  var transition = 2 * maxGroupWidth / (totalBarsWidth + totalPaddingsWidth)

  var xScale = d3.scale.ordinal()
    .domain(d3.range(range))
    .rangeBands([-margin, config.width + margin], config.padding, 0)

  var yScale = d3.scale.linear()
    .domain([0, config.maxValue || 0])
    .range([0, config.height])

  /* No need to keep more elements that we are going to preset in the chart */
  config.dataSet.length = Math.ceil(range)

  var svg = d3.select(config.uiSelector)
    .attr('width', config.width)
    .attr('height', config.height)

  var chartGroup = svg.append('svg:g')
    .attr('transform', 'translate(' + transition + ', 0)')

  /* Use this to totally switch the base chart data or to re-init it */
  function setData (dataSet) {
    if (isDestroyed) {
      throw new ReferenceError('Chart destroyed')
    }

    if (!(dataSet instanceof Array)) {
      throw new TypeError('1st argument must be an {Array} "dataSet" but same is {' + getInstance(dataSet) + '} ' + dataSet)
    }

    config.dataSet = dataSet
  }

  /* This function will add the incoming 'item' as a last element in the chart current data set */
  function addOneDataItem (item) {
    if (isDestroyed) {
      throw new ReferenceError('Chart destroyed')
    }

    if (typeof item !== 'number' &&
      (
        item === null ||
        typeof item !== 'object' ||
        typeof item.value !== 'number'
      )
    ) {
      throw new TypeError('1st argument must be either {number} or {JSON} object with property {Number} "value" (e.g. {"value": 7}) but same is {' + getInstance(item) + '} ' + item)
    }

    config.dataSet.push(item)
  }

  /* Animate the drawing shifting from right-to-left using the current data set */
  function draw (callback) {
    if (isDestroyed) {
      throw new ReferenceError('Chart destroyed')
    }

    if (callback !== undefined &&
        typeof callback !== 'function'
    ) {
      throw new TypeError('1st argument is optional but if it is set it must be {Function} "callback" but same is {' + getInstance(callback) + '} ' + callback)
    }

    /* No need to keep more elements that we are going to preset in the chart */
    config.dataSet.length = Math.ceil(range)

    /* Check if we need to rescale for every new data set or we already have a set upper limit as 'config.maxValue' */
    if (config.maxValue === undefined) {
      yScale = d3.scale.linear()
        .domain([0, config.dataSet.reduce((max, item) => Math.max(max, (item && typeof item === 'object') ? item.value : item))])
        .range([0, config.height])
    }

    /* Set the scalar values from the 'config.dataSet' into the UI presentation of each '.x_bar' */
    var bars = chartGroup
      .selectAll('rect.x_bar')
      .data(config.dataSet.map((item) => (item && typeof item === 'object') ? item.value : item))

    bars
      .enter()
      .append('svg:rect')

    /* Design each bar in its specified way using its own styles of the default ones */
    bars
      .attr('class', 'x_bar')
      .attr('stroke-width', function setStrokeWidth (value, index) {
        var item = config.dataSet[index]
        return (item && typeof item === 'object') ? item.strokeWidth : config.defaultStyle.strokeWidth
      })
      .attr('stroke', function setStrokeColor (value, index) {
        var item = config.dataSet[index]
        return (item && typeof item === 'object') ? item.strokeColor : config.defaultStyle.strokeColor
      })
      .attr('fill', function setFillColor (value, index) {
        var item = config.dataSet[index]
        return (item && typeof item === 'object') ? item.fillColor : config.defaultStyle.fillColor
      })
      .attr('x', (value, index) => xScale(index))
      .attr('y', (value, index) => config.height - yScale(value))
      .attr('width', xScale.rangeBand())
      .attr('height', yScale)

    /* Start a slowly shifting animation so the new data can be view and the old to be removed */
    chartGroup
      .attr('transform', 'translate(' + transition + ', 0)')
      .transition()
      .ease('linear')
      .duration(config.duration)
      .attr('transform', 'translate(0, 0)')
      .each('end', function onAnimationCompleted () {
        config.dataSet.shift()
        if (typeof callback === 'function') {
          callback()
        }
      })
  }

  /* Remove main UI container and signal to all components to refuse bindings to it */
  function destroy () {
    if (isDestroyed) {
      throw new ReferenceError('Chart already destroyed')
    }

    isDestroyed = true

    const svg = document.querySelector(config.uiSelector)
    Array.from(svg.childNodes)
      .forEach((node) => svg.removeChild(node))
  }

  function isChartDestroyed () {
    return isDestroyed
  }

  /* Give external access only to main data and animation functions */
  return {
    setData,
    addOneDataItem,
    draw,
    destroy,
    isChartDestroyed
  }
}

/*
  Returns an instance of UI Line Chart presentation.
  Use the returned functions to manipulate chart data and when ready - call 'draw()'.
  Each configuration property of 'config' have its own validation so use those messages as a configuration description.
*/
function createShiftingLineChart (config) {
  /*
    'Object.prototype.toString' will do all safe checks for us and give the 'variable' constructor.
    Example:
      getInstance()                =>  "Undefined"
      getInstance(  undefined   )  =>  "Undefined"
      getInstance(     null     )  =>  "Null"
      getInstance(     true     )  =>  "Boolean"
      getInstance(      ''      )  =>  "String"
      getInstance(       1      )  =>  "Number"
      getInstance(      {}      )  =>  "Object"
      getInstance(      []      )  =>  "Array"
      getInstance(    Error     )  =>  "Function"
      getInstance( new Error()  )  =>  "Error"
      getInstance( new RegExp() )  =>  "RegExp"
  */
  function getInstance (variable) {
    return Object.prototype.toString.call(variable).replace('[object ', '').replace(']', '')
  }

  /* Returns a DOM id attribute that is not used at the moment */
  function getUniqueDomId () {
    do {
      var id = ('x_' + Math.random()).replace(/\./g, '')
    } while (document.getElementById(id))
    return id
  }

  /* Input validation and setting default values */
  ;(function inputValidation () {
    var colorRegExp = /^#[0-9a-f]{3,6}$/i

    if (!config ||
        typeof config !== 'object'
    ) {
      config = {}
    }

    if (!config.uiSelector ||
        typeof config.uiSelector !== 'string'
    ) {
      throw new TypeError('1st argument {object} must have property {String} "uiSelector" but same is {' + getInstance(config.uiSelector) + '} ' + config.uiSelector)
    }

    if (!d3.select(config.uiSelector) ||
        !d3.select(config.uiSelector)[0] ||
        !d3.select(config.uiSelector)[0][0]
    ) {
      throw new TypeError('1st argument {object} must have property {String} "uiSelector" that matches existing DOM element but there is no match for selector "' + config.uiSelector + '"')
    }

    if (config.width === undefined) {
      config.width = 600
    }

    if (!config.width ||
        typeof config.width !== 'number' ||
        config.width < 0
    ) {
      throw new TypeError('1st argument {object}, if optional property "width" is set, it must be positive {Number} "width" but same is {' + getInstance(config.width) + '} ' + config.width)
    }

    /* Will be used for x-scaling, useful when we want to match other charts width */
    if (config.customScaleWidth === undefined) {
      config.customScaleWidth = 0
    }

    if (!config.customScaleWidth ||
        typeof config.customScaleWidth !== 'number' ||
        config.customScaleWidth < 0
    ) {
      throw new TypeError('1st argument {object}, if optional property "customScaleWidth" is set, it must be positive {Number} "customScaleWidth" but same is {' + getInstance(config.customScaleWidth) + '} ' + config.customScaleWidth)
    }

    if (config.height === undefined) {
      config.height = 400
    }

    if (!config.height ||
        typeof config.height !== 'number' ||
        config.height < 0
    ) {
      throw new TypeError('1st argument {object}, if optional property "height" is set, it must be positive {Number} "height" but same is {' + getInstance(config.height) + '} ' + config.height)
    }

    if (config.maxValue !== undefined &&
        typeof config.maxValue !== 'number'
    ) {
      throw new TypeError('1st argument {object}, if optional property "maxValue" is set, it must be {Number} "maxValue" but same is {' + getInstance(config.maxValue) + '} ' + config.maxValue)
    }

    if (config.duration === undefined) {
      config.duration = 5000
    }

    if (!config.duration ||
        typeof config.duration !== 'number' ||
        config.duration < 0 ||
        config.duration % 1
    ) {
      throw new TypeError('1st argument {object}, if optional property "duration" is set, it must be positive {Integer} "duration" but same is {' + getInstance(config.duration) + '} ' + config.duration)
    }

    if (config.maxVisibleLines === undefined) {
      config.maxVisibleLines = 5
    }

    if (!config.maxVisibleLines ||
        typeof config.maxVisibleLines !== 'number' ||
        config.maxVisibleLines < 0 ||
        config.maxVisibleLines % 1
    ) {
      throw new TypeError('1st argument {object}, if optional property "maxVisibleLines" is set, it must be positive {Integer} "maxVisibleLines" but same is {' + getInstance(config.maxVisibleLines) + '} ' + config.maxVisibleLines)
    }

    if (config.defaultStyle === undefined) {
      config.defaultStyle = {}
    }

    if (!config.defaultStyle ||
        typeof config.defaultStyle !== 'object'
    ) {
      throw new TypeError('1st argument {object}, if optional property "defaultStyle" is set, it must be {JSON} object "defaultStyle" but same is {' + getInstance(config.defaultStyle) + '} ' + config.defaultStyle)
    }

    if (config.defaultStyle.strokeWidth === undefined) {
      config.defaultStyle.strokeWidth = 1
    }

    if (typeof config.defaultStyle.strokeWidth !== 'number' ||
        config.defaultStyle.strokeWidth < 0
    ) {
      throw new TypeError('1st argument {object}, if optional property "defaultStyle.strokeWidth" is set, it must be non-negative {Number} "defaultStyle.strokeWidth" but same is {' + getInstance(config.defaultStyle.strokeWidth) + '} ' + config.defaultStyle.strokeWidth)
    }

    if (config.defaultStyle.strokeColor === undefined) {
      config.defaultStyle.strokeColor = '#000'
    }

    if (!colorRegExp.test(config.defaultStyle.strokeColor)) {
      throw new TypeError('1st argument {object}, if optional property "defaultStyle.strokeColor" is set, it must match a {Color} regular expression "' + colorRegExp.toString() + '" but same is {' + getInstance(config.defaultStyle.strokeColor) + '} ' + config.defaultStyle.strokeColor)
    }

    if (config.defaultStyle.fillColor === undefined) {
      config.defaultStyle.fillColor = 'none'
    }

    if (config.defaultStyle.fillColor !== 'none' &&
        !colorRegExp.test(config.defaultStyle.fillColor)
    ) {
      throw new TypeError('1st argument {object}, if optional property "defaultStyle.fillColor" is set, it must be {String} "none" or match a {Color} regular expression "' + colorRegExp.toString() + '" but same is {' + getInstance(config.defaultStyle.fillColor) + '} ' + config.defaultStyle.fillColor)
    }

    if (config.dataSet === undefined) {
      config.dataSet = []
    }

    if (!(config.dataSet instanceof Array)) {
      throw new TypeError('1st argument {object}, if optional property "dataSet" is set, it must be an {Array} "dataSet" but same is {' + getInstance(config.dataSet) + '} ' + config.dataSet)
    }
  })()

  /*
    Tells whenever a 'destroy()' function is been called and
    if all components are removed
  */
  let isDestroyed = false

  var xScale = d3.scale.linear()
    .domain([0, config.maxVisibleLines])
    .range([0, config.customScaleWidth || config.width])

  var yScale = d3.scale.linear()
    .domain([0, config.maxValue || 0])
    .range([config.height, 0])

  /* Use the specified DOM element as a wrapper SVG for the entire chart */
  var svg = d3.select(config.uiSelector)
    .attr('width', config.width + 'px')
    .attr('height', config.height)

  /* Created 'clipPath' will limit the rendering area and smooth the transitions between newly added lines */
  var clipPathId = getUniqueDomId()
  svg
    .append('defs')
    .append('clipPath')
    .attr('id', clipPathId)
    .append('rect')
    .attr('width', config.width + 'px')
    .attr('height', config.height)

  /* Create the main line path and nested using the 'clipPath' field and predetermined styles */
  var line = d3.svg.line()
    .interpolate('linear')
    .x((value, index) => xScale(index))
    .y((value, index) => yScale(value))

  var group = svg.append('g')
    .attr('width', config.width + 'px')
    .attr('clip-path', `url(#${clipPathId})`)

  var path = group
    .append('path')
    .datum(config.dataSet)
    .attr('width', config.width + 'px')
    .attr('stroke-width', config.defaultStyle.strokeWidth)
    .attr('stroke', config.defaultStyle.strokeColor)
    .attr('fill', config.defaultStyle.fillColor)
    .attr('d', line)

  /*
    Replace the entire data set with the one suggested
    but not loosing the variable reference (it's been used in '.datum(config.dataSet)')
  */
  function setData (newData) {
    if (isDestroyed) {
      throw new ReferenceError('Chart destroyed')
    }

    if (!(newData instanceof Array)) {
      throw new TypeError(`1st argument "newData" must be an {Array} but it is {${getInstance(newData)}} ${newData}`)
    }

    config.dataSet.length = 0
    newData.forEach((item) => config.dataSet.push(item))
  }

  /* This function will add the incoming 'item' as a last element in the chart current data set */
  function addOneDataItem (item) {
    if (isDestroyed) {
      throw new ReferenceError('Chart destroyed')
    }

    if (typeof item !== 'number') {
      throw new TypeError('1st argument must be either {number} but same is {' + getInstance(item) + '} ' + item)
    }

    config.dataSet.push(item)
  }

  /* Animate the drawing shifting from right-to-left using the current data set */
  function draw (callback) {
    if (isDestroyed) {
      throw new ReferenceError('Chart destroyed')
    }

    if (callback !== undefined &&
        typeof callback !== 'function'
    ) {
      throw new TypeError('1st argument is optional but if it is set it must be {Function} "callback" but same is {' + getInstance(callback) + '} ' + callback)
    }

    /* No need to keep more elements that we are going to preset in the chart */
    /* We add '+ 2' for those lines in the most left and most right that are half visible in the field */
    config.dataSet.length = Math.min(config.dataSet.length, Math.ceil(config.maxVisibleLines + 2))

    /* Check if we need to rescale for every new data set or we already have a set upper limit as 'config.maxValue' */
    if (config.maxValue === undefined) {
      yScale = d3.scale.linear()
        .domain([0, config.dataSet.reduce((max, item) => Math.max(max, item))])
        .range([config.height, 0])
    }

    /* Redraw the line, and then slide it to the left */
    path
      .attr('d', line)
      .attr('width', config.width + 'px')
      .attr('transform', 'translate(0, 0)')
      .transition()
      .duration(config.duration)
      .ease('linear')
      .attr('transform', 'translate(' + xScale(-1) + ', 0)')
      .attr('width', config.width + 'px')
      .each('end', function onAnimationCompleted () {
        config.dataSet.shift()
        if (typeof callback === 'function') {
          callback()
        }
      })
  }

  /* Remove main UI container and signal to all components to refuse bindings to it */
  function destroy () {
    if (isDestroyed) {
      throw new ReferenceError('Chart already destroyed')
    }

    isDestroyed = true

    const svg = document.querySelector(config.uiSelector)
    Array.from(svg.childNodes)
      .forEach((node) => svg.removeChild(node))
  }

  function isChartDestroyed () {
    return isDestroyed
  }

  return {
    setData,
    addOneDataItem,
    draw,
    destroy,
    isChartDestroyed
  }
}

export default {
  createShiftingBarChart,
  createShiftingLineChart
}
