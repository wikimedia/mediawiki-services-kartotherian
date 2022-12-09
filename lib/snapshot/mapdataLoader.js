'use strict';

const _ = require( 'underscore' );
const urllib = require( 'url' );
const DataManager = require( '@wikimedia/mapdata' );
const preq = require( 'preq' );
const Promise = require( 'bluebird' );
const { unrollGeoJSON } = require( './util' );

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
	groupIds, userAgent, mwapi
) {
	const MWApi = mwapi || require( 'mwapi' );

	const dm = new DataManager( {
		createPromise: ( callback ) => new Promise( callback ),
		whenAllPromises: Promise.all,
		isEmptyObject: _.isEmpty,
		isPlainObject: _.isObject,
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
			return preq.get( request ).then(
				( response ) => response.body
			);
		},
		// TODO we might want to setup and use the apiUtil lib here
		mwApi: ( request ) =>
			new MWApi( userAgent, `${protocol}://${domain}/w/api.php` )
				.execute( request )
	} );

	const dataGroups = await dm.loadGroups( groupIds, title, revid );
	if ( !dataGroups.length ) {
		throw new Error( `Empty loadGroups response for: ${groupIds}; domain: ${domain}; title: ${title}; req url: ${req.url}` );
	}

	const successfulGroups = dataGroups.filter( ( group ) => {
		if ( group.failed ) {
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
	mapdata.sort( ( a, b ) => {
		return b.geometry.coordinates[ 1 ] - a.geometry.coordinates[ 1 ];
	} );

	// Wrap in a collection when more than one feature is present.
	return mapdata.length === 1 ?
		mapdata[ 0 ] :
		{ type: 'FeatureCollection', features: mapdata };
}

module.exports = {
	downloadMapdata
};
