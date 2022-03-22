const bbox = require( '@turf/bbox' ).default;
const { viewport } = require( '@mapbox/geo-viewport' );

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
module.exports = function autoPosition( params, data ) {
	const autobbox = bbox( data );
	const autoviewport = viewport( autobbox, [ params.w, params.h ] );
	const autolon = autoviewport.center[ 0 ];
	const autolat = autoviewport.center[ 1 ];
	const autocenter = autoviewport.zoom;

	return {
		latitude: params.lat === 'a' ? autolat : params.lat,
		longitude: params.lon === 'a' ? autolon : params.lon,
		zoom: params.zoom === 'a' ? autocenter : params.zoom
	};
};
