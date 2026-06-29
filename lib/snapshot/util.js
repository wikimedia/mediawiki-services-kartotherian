'use strict';

const _ = require( 'underscore' );

/*
 * Assert some minimum structure.
 *
 * @param {Object} geoJSON incoming data
 * @throws {Error} if the feature is invalid
 */
function validateFeature( geoJSON ) {
	if ( geoJSON === null ) {
		throw new Error( 'Bad GeoJSON - is null' );
	}
	if ( !_.isObject( geoJSON ) ) {
		throw new Error( `Bad GeoJSON - unknown javascript type "${ typeof ( geoJSON ) }"` );
	}
	if ( !geoJSON.type ) {
		throw new Error( 'Bad GeoJSON - object has no "type" property' );
	}
	if ( geoJSON.type !== 'Feature' ) {
		throw new Error( `Bad GeoJSON - unknown "type" property "${ geoJSON.type }"` );
	}
}

/**
 * Recursively flatten the map data structure.
 *
 * Invalid or unresolved entries (e.g. ExternalData whose geoshape fetch
 * returned no results) are logged and skipped rather than crashing.
 *
 * @param {Object|Object[]} geoJSON object or array of objects
 * @param {Function} [log] optional logging function(level, message)
 * @return {Object[]} A list of simple "Feature" geometry with no children.
 */
function unrollGeoJSON( geoJSON, log ) {
	if ( Array.isArray( geoJSON ) ) {
		// Recurse over array of objects
		return _.flatten( geoJSON.map( ( item ) => unrollGeoJSON( item, log ) ) );
	} else if ( geoJSON && geoJSON.features ) {
		// FeatureCollection
		return _.flatten( geoJSON.features.map( ( item ) => unrollGeoJSON( item, log ) ) );
	} else {
		// Single feature
		try {
			validateFeature( geoJSON );
		} catch ( err ) {
			if ( log ) {
				log( 'warn', err.message );
			}
			return [];
		}
		return [ { properties: {}, ...geoJSON } ];
	}
}

module.exports = {
	unrollGeoJSON
};
