'use strict';

const _ = require( 'underscore' );
const urllib = require( 'url' );
const MWApi = require( 'mwapi' );
const DataManager = require( '@wikimedia/mapdata' );
const preq = require( 'preq' );
const Promise = require( 'bluebird' );

function expandArraysAndCollections( mapdata, geojson ) {
	if ( Array.isArray( geojson ) ) {
		for ( const v of geojson ) {
			expandArraysAndCollections( mapdata, v );
		}
	} else if ( _.isObject( geojson ) ) {
		if ( !geojson.type ) { throw new Error( 'Bad geojson - object has no type' ); }
		switch ( geojson.type ) {
			case 'FeatureCollection':
				expandArraysAndCollections( mapdata, geojson.features );
				break;
			case 'Feature':
				// init empty "properties" so it doesn't fail with
				// "invalid json" in geojson-mapnikify
				mapdata.push( { ...geojson, properties: geojson.properties || {} } );
				break;
			default:
				throw new Error( `Bad geojson - unknown type ${geojson.type}` );
		}
	} else {
		throw new Error( `Bad geojson - unknown type ${typeof ( geojson )}` );
	}
}

function createPromise( callback ) {
	return new Promise( callback );
}

/**
 * Download map data from MW api
 *
 * @param {express.Request} req web request object
 * @param {string} protocol - "http" or "https"
 * @param {string} domain - "en.wikipedia.org"
 * @param {string} title - title of the page - ok to be unsanitized
 * @param {string|boolean} revid - desired revision ID, or false to omit
 * @param {string|string[]} groupIds
 * @return {Promise}
 */
module.exports = function downloadMapdata( req, protocol, domain, title, revid, groupIds ) {
	const dm = new DataManager( {
		createPromise,
		whenAllPromises: Promise.all,
		isEmptyObject: _.isEmpty,
		isPlainObject: _.isObject,
		isArray: _.isArray,
		extend: _.extend,
		getJSON: ( url ) => {
			let fullUrl = url;
			if ( url[ 0 ] === '/' && url[ 1 ] === '/' ) {
				// Workaround: urllib does not support relative URLs
				fullUrl = `${protocol}:${url}`;
			}
			// eslint-disable-next-line node/no-deprecated-api
			const urlParts = urllib.parse( fullUrl );
			if ( !urlParts.protocol ) { urlParts.protocol = protocol; }
			if ( !urlParts.hostname ) { urlParts.hostname = domain; }
			if ( !urlParts.slashes ) { urlParts.slashes = true; }

			const request = {
				uri: urllib.format( urlParts ),
				headers: { 'User-Agent': 'kartotherian-getJSON (geoshapes)' },
				retries: 0
			};
			return preq.get( request ).then( ( response ) => response.body );
		},
		mwApi: ( request ) => {
			const mwapi = new MWApi( 'kartotherian (yurik @ wikimedia)', `${protocol}://${domain}/w/api.php` );
			return mwapi.execute( request );
		},
		title,
		revid
	} );

	return dm.loadGroups( groupIds ).then( ( dataGroups ) => {
		const mapdata = [];

		if ( !dataGroups.length ) {
			req.logger.log( 'warn', `groupIds not available: ${groupIds}; domain: ${domain}; title: ${title}; req url: ${req.url}` );
		}

		for ( let i = 0; i < dataGroups.length; i++ ) {
			expandArraysAndCollections( mapdata, dataGroups[ i ].getGeoJSON() );
		}

		if ( mapdata.length === 1 ) { return mapdata[ 0 ]; }
		return { type: 'FeatureCollection', features: mapdata };
	} );
};
