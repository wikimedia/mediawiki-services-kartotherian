'use strict';

const _ = require( 'underscore' );
const urllib = require( 'url' );
const MWApi = require( 'mwapi' );
const DataManager = require( '@wikimedia/mapdata' );
const preq = require( 'preq' );
const Promise = require( 'bluebird' );

/**
 * @param {Object[]} features out parameter with a flat list of features collected from the incoming
 *  geoJSON
 * @param {Array|Object} geoJSON incoming data
 */
function flattenArraysAndFeatureCollections( features, geoJSON ) {
	if ( Array.isArray( geoJSON ) ) {
		for ( const v of geoJSON ) {
			flattenArraysAndFeatureCollections( features, v );
		}
	} else if ( _.isObject( geoJSON ) ) {
		if ( !geoJSON.type ) { throw new Error( 'Bad GeoJSON - object has no type' ); }
		switch ( geoJSON.type ) {
			case 'FeatureCollection':
				flattenArraysAndFeatureCollections( features, geoJSON.features );
				break;
			case 'Feature':
				// init empty "properties" so it doesn't fail with
				// "invalid json" in geojson-mapnikify
				features.push( { ...geoJSON, properties: geoJSON.properties || {} } );
				break;
			default:
				throw new Error( `Bad GeoJSON - unknown type ${geoJSON.type}` );
		}
	} else {
		throw new Error( `Bad GeoJSON - unknown type ${typeof ( geoJSON )}` );
	}
}

function createPromise( callback ) {
	return new Promise( callback );
}

/**
 * Download map data from MediaWiki API
 *
 * @param {express.Request} req web request object
 * @param {string} protocol - "http" or "https"
 * @param {string} domain - "en.wikipedia.org"
 * @param {string} title - title of the page - ok to be unsanitized
 * @param {string|boolean} revid - desired revision ID, or false to omit
 * @param {string|string[]} groupIds
 * @param {string} userAgent
 * @return {Promise}
 */
module.exports = function downloadMapdata( req, protocol, domain, title, revid,
	groupIds, userAgent
) {
	const dm = new DataManager( {
		createPromise,
		whenAllPromises: Promise.all,
		isEmptyObject: _.isEmpty,
		isPlainObject: _.isObject,
		isArray: _.isArray,
		extend: _.extend,
		getJSON: ( url ) => {
			if ( url.startsWith( '//' ) ) {
				// Workaround: urllib does not support relative URLs
				url = `${protocol}:${url}`;
			}
			// eslint-disable-next-line node/no-deprecated-api
			const urlParts = urllib.parse( url );
			if ( !urlParts.protocol ) { urlParts.protocol = protocol; }
			if ( !urlParts.hostname ) { urlParts.hostname = domain; }
			if ( !urlParts.slashes ) { urlParts.slashes = true; }

			const request = {
				uri: urllib.format( urlParts ),
				headers: { 'User-Agent': userAgent },
				retries: 0
			};
			return preq.get( request ).then( ( response ) => response.body,
				function () {
					req.logger.log( 'warn', 'Querying ' + urllib.format( urlParts ) + ' failed: ' + JSON.stringify( arguments ) );
				}
			);
		},
		mwApi: ( request ) => {
			const mwapi = new MWApi( userAgent, `${protocol}://${domain}/w/api.php` );
			return mwapi.execute( request );
		},
		title,
		revid,
		log: req.logger && req.logger.log
	} );

	return dm.loadGroups( groupIds ).then( ( dataGroups ) => {
		if ( !dataGroups.length ) {
			req.logger.log( 'warn', `groupIds not available: ${groupIds}; domain: ${domain}; title: ${title}; req url: ${req.url}` );
		}

		const mapdata = [];
		for ( let i = 0; i < dataGroups.length; i++ ) {
			flattenArraysAndFeatureCollections( mapdata, dataGroups[ i ].getGeoJSON() );
		}

		return mapdata.length === 1 ?
			mapdata[ 0 ] :
			{ type: 'FeatureCollection', features: mapdata };
	}, function () {
		req.logger.log( 'warn', 'loadGroups( ' + groupIds + ') failed: ' + JSON.stringify( arguments ) );
	} );
};
