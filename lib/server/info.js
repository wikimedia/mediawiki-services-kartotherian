'use strict';

const infoHeaders = {};
const util = require( 'util' );
const Err = require( '../err' );
const Promise = require( 'bluebird' );

let core;

/**
 * Web server (express) route handler to get requested tile or info
 *
 * @param {Object} req request object
 * @param {Object} res response object
 * @param {Promise} next will be called if request is not handled
 * @return {Promise}
 */
function requestHandler( req, res, next ) {
	const start = Date.now();
	let source;

	return Promise.try( () => {
		source = core.getPublicSource( req.params.src );
		// check for optional parameter publicinfo
		if ( source.publicinfo === false ) {
			throw new Err( 'Source info is not public' ).metrics( 'err.req.sourceinfo' );
		}
		return source.getHandler().getInfoAsync().then( ( info ) => [ info, infoHeaders ] );
	} ).spread( ( data, dataHeaders ) => {
		core.setResponseHeaders( res, source, dataHeaders );

		if ( req.query && req.query.format ) {
			const escapedText = JSON.stringify( data, null, ' ' ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' );
			res.send( `<pre>${ escapedText }</pre>` );
		} else {
			res.json( data );
		}

		const mx = util.format( 'req.%s.info', req.params.src );
		core.metrics.makeMetric( {
			type: 'Histogram',
			name: mx,
			prometheus: {
				buckets: [ 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000 ],
				name: 'kartotherian_' + mx.replace( '.', '_' ) + '_milliseconds',
				help: 'Time to serve an info.json request'
			}
		} ).endTiming( start );
	} ).catch( ( err ) => core.reportRequestError( err, res ) ).catch( next );
}

module.exports = function info( cor, router ) {
	core = cor;

	// get source info (json)
	router.get( `/:src(${ core.Sources.sourceIdReStr })/info.json`, requestHandler );
};
