'use strict';

const bbox = require( '@turf/bbox' ).default;
const { viewport } = require( '@mapbox/geo-viewport' );

/**
 * Gets the most optimal center and zoom for the map so that all the features
 * are visible. Defaults to minzoom and zero lat and lon when autoposition fails.
 *
 * @param {Object} params Parameters from `requestHandler`
 * @param {Object} data GeoJSON for the map
 * @param {number} [minzoom]
 * @param {number} [maxzoom]
 * @return {{latitude: number, longitude: number, zoom: number, success: boolean}}
 */
module.exports = function autoPosition( params, data, minzoom, maxzoom ) {
	let latitude = params.lat,
		longitude = params.lon,
		zoom = params.zoom,
		success;

	if ( [ latitude, longitude, zoom ].includes( 'a' ) ) {
		const autobbox = bbox( data );
		success = autobbox.every( Number.isFinite );
		if ( success ) {
			const autoviewport = viewport( autobbox, [ params.w, params.h ], minzoom, maxzoom );
			if ( latitude === 'a' ) {
				latitude = autoviewport.center[ 1 ];
			}
			if ( longitude === 'a' ) {
				longitude = autoviewport.center[ 0 ];
			}
			if ( zoom === 'a' ) {
				zoom = autoviewport.zoom;
			}
		}
	}

	longitude = longitude !== 'a' ? longitude : 0;
	latitude = latitude !== 'a' ? latitude : 0;
	zoom = zoom !== 'a' ? zoom : minzoom;

	return { latitude, longitude, zoom, success };
};
