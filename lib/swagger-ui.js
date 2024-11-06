'use strict';

const BBPromise = require( 'bluebird' );
const fs = BBPromise.promisifyAll( require( 'fs' ) );
const path = require( 'path' );
const HTTPError = require( '../lib/util.js' ).HTTPError;

// Swagger-ui-dist helpfully exporting the absolute path of its dist directory
const docRoot = `${ require( 'swagger-ui-dist' ).getAbsoluteFSPath() }/`;
const DOC_CSP = "default-src 'none'; " +
    "script-src 'self' 'unsafe-inline'; connect-src *; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';";

function processRequest( app, req, res ) {
	let reqPath;
	let filePath;
	if ( !req.query.path ) {
		reqPath = '/index.html';
		filePath = `${ __dirname }/../static/swagger-ui.html`;
	} else {
		reqPath = req.query.path;
		filePath = path.join( docRoot, reqPath );

		// Disallow relative paths.
		// Test relies on docRoot ending on a slash.
		if ( filePath.slice( 0, Math.max( 0, docRoot.length ) ) !== docRoot ) {
			throw new HTTPError( {
				status: 404,
				type: 'not_found',
				title: 'File not found',
				detail: `${ reqPath } could not be found.`
			} );
		}
	}

	return fs.readFileAsync( filePath )
		.then( ( body ) => {
			let contentType;
			if ( reqPath === '/index.html' ) {
				body = body.toString();
				contentType = 'text/html';
			} else if ( /\.js$/.test( reqPath ) ) {
				contentType = 'text/javascript';
				body = body.toString()
					.replace( /underscore-min\.map/, '?doc&path=lib/underscore-min.map' )
					.replace( /sourceMappingURL=/, 'sourceMappingURL=/?doc&path=' );
			} else if ( /\.png$/.test( reqPath ) ) {
				contentType = 'image/png';
			} else if ( /\.map$/.test( reqPath ) ) {
				contentType = 'application/json';
			} else if ( /\.ttf$/.test( reqPath ) ) {
				contentType = 'application/x-font-ttf';
			} else if ( /\.css$/.test( reqPath ) ) {
				contentType = 'text/css';
				body = body.toString()
					.replace( /\.\.\/(images|fonts)\//g, '?doc&path=$1/' )
					.replace( /sourceMappingURL=/, 'sourceMappingURL=/?doc&path=' );
			}

			res.header( 'content-type', contentType );
			res.header( 'content-security-policy', DOC_CSP );
			res.header( 'x-content-security-policy', DOC_CSP );
			res.header( 'x-webkit-csp', DOC_CSP );
			res.send( body.toString() );
		} )
		.catch( { code: 'ENOENT' }, () => {
			res.status( 404 )
				.type( 'not_found' )
				.send( 'not found' );
		} );

}

module.exports = {
	processRequest
};
