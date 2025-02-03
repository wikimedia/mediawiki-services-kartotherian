'use strict';

const _ = require( 'underscore' );
const urllib = require( 'url' );
const DataManager = require( '@wikimedia/mapdata' );
const preq = require( 'preq' );
const Promise = require( 'bluebird' );
const { unrollGeoJSON } = require( './util' );
const { mwApiGet } = require( '../api-util' );

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
 * @param {Function} [mwapi] API constructor
 * @return {Promise}
 */
async function downloadMapdata( req, protocol, domain, title, revid,
	groupIds, userAgent
) {

	const dm = new DataManager( {
		createPromise: ( callback ) => new Promise( callback ),
		whenAllPromises: Promise.all,
		isEmptyObject: _.isEmpty,
		isPlainObject: _.isObject,
		extend: _.extend,
		getJSON: ( url ) => {
			if ( url.startsWith( '//' ) ) {
				// Workaround: urllib does not support relative URLs
				url = `${ protocol }:${ url }`;
			}
			// eslint-disable-next-line n/no-deprecated-api
			const urlParts = urllib.parse( url );
			if ( !urlParts.protocol ) {
				urlParts.protocol = protocol;
			}
			if ( !urlParts.hostname ) {
				urlParts.hostname = domain;
			}
			if ( !urlParts.slashes ) {
				urlParts.slashes = true;
			}

			const headers = { 'User-Agent': userAgent };

			// Rewrite URL to use local service endpoint
			if ( req.app.conf.rewrite_local_service_url ) {
				const originalHostname = urlParts.hostname;
				if ( urlParts.hostname === 'maps.wikimedia.org' ) {
					urlParts.host = `localhost:${ req.app.conf.port }`;
					urlParts.hostname = 'localhost';
					urlParts.port = req.app.conf.port;
					urlParts.protocol = 'http:';
				} else if ( urlParts.pathname === '/w/api.php' ) {
					const uri = new URL( req.app.conf.geoshapes.mw_api.uri );
					urlParts.hostname = uri.hostname;
					urlParts.protocol = uri.protocol;
					urlParts.port = uri.port;
				} else {
					throw new Error( `Couldn't handle url with service mesh: ${ url }` );
				}

				headers.Host = originalHostname;
			}

			const request = {
				uri: urllib.format( urlParts ),
				retries: 0,
				headers: headers
			};

			return preq.get( request ).then(
				( response ) => response.body
			);
		},
		// TODO we might want to setup and use the apiUtil lib here
		mwApi: ( params ) => mwApiGet( req, domain, params ).then( ( response ) => response.body )
	} );

	const dataGroups = await dm.loadGroups( groupIds, title, revid );
	if ( !dataGroups.length ) {
		throw new Error( `Empty loadGroups response for: ${ groupIds }; domain: ${ domain }; title: ${ title }; req url: ${ req.url }` );
	}

	const successfulGroups = dataGroups.filter( ( group ) => {
		if ( group.name && group.name.startsWith( '_' ) && group.failureReason ) {
			let message = 'Received failed group: ' + group.failureReason;
			if ( group.getGeoJSON() && group.getGeoJSON().url ) {
				message += ' with URL ' + group.getGeoJSON().url;
			}
			req.logger.log( 'warn', message );
		}
		return !group.failed;
	} );
	const groupGeometries = successfulGroups.map( ( group ) => group.getGeoJSON() );
	const mapdata = unrollGeoJSON( groupGeometries );

	// Sort geopoints from north to south so that they overlap nicely.
	mapdata.sort( ( a, b ) => a.geometry &&
		b.geometry &&
		a.geometry.coordinates &&
		b.geometry.coordinates &&
		( b.geometry.coordinates[ 1 ] - a.geometry.coordinates[ 1 ] )
	);

	// Wrap in a collection when more than one feature is present.
	return mapdata.length === 1 ?
		mapdata[ 0 ] :
		{ type: 'FeatureCollection', features: mapdata };
}

module.exports = {
	downloadMapdata
};
