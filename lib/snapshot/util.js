'use strict';

const _ = require( 'underscore' );

/*
 * Assert some minimum structure.
 *
 * @param {Object} geoJSON incoming data
 */
function validateFeature( geoJSON ) {
	if ( geoJSON === null ) {
		throw new Error( 'Bad GeoJSON - is null' );
	}
	if ( !_.isObject( geoJSON ) ) {
		throw new Error( `Bad GeoJSON - unknown javascript type "${typeof ( geoJSON )}"` );
	}
	if ( !geoJSON.type ) {
		throw new Error( 'Bad GeoJSON - object has no "type" property' );
	}
	if ( geoJSON.type !== 'Feature' ) {
		throw new Error( `Bad GeoJSON - unknown "type" property "${geoJSON.type}"` );
	}
}

/**
 * Recursively flatten the map data structure.
 *
 * Any invalid data aborts the unrolling via exception.
 *
 * @param {Object|Object[]} geoJSON object or array of objects
 * @return {Object[]} A list of simple "Feature" geometry with no children.
 */
function unrollGeoJSON( geoJSON ) {
	if ( Array.isArray( geoJSON ) ) {
		// Recurse over array of objects
		return _.flatten( geoJSON.map( unrollGeoJSON ) );
	} else if ( geoJSON && geoJSON.features ) {
		// FeatureCollection
		return _.flatten( geoJSON.features.map( unrollGeoJSON ) );
	} else {
		// Single feature

		// FIXME: Should be the job of the mapdata library, and also seems that
		// we should log and ignore errors here, rather than crash.
		validateFeature( geoJSON );

		return [ { properties: {}, ...geoJSON } ];
	}
}

module.exports = {
	unrollGeoJSON
};
