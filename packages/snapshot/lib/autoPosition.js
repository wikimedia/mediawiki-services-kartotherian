"use strict";

var bbox = require("@turf/bbox").default;
var { viewport } = require("@mapbox/geo-viewport");

/**
 * Gets the most optimal center and zoom for the map so that all the features
 * are visible.
 *
 * @param {Object} params Parameters from `requestHandler`
 * @param {Object} data GeoJSON for the map
 * @return {Object}
 * @return {number[]} return.center Latitude and longitude.
 * @return {number} return.zoom Zoom
 */
module.exports = function autoPosition(params, data) {
  
  var autobbox = bbox(data);
  var autoviewport = viewport(autobbox, [params.w, params.h])
  var autolon = autoviewport.center[0]
  var autolat = autoviewport.center[1]
  var autocenter = autoviewport.zoom

  return {
    latitude: params.lat === "a" ? autolat : params.lat,
    longitude: params.lon === "a" ? autolon : params.lon,
    zoom: params.zoom === "a" ? autocenter : params.zoom,
  };
};
