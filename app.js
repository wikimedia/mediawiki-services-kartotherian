'use strict';

const http = require( 'http' );
const BBPromise = require( 'bluebird' );
const express = require( 'express' );
const compression = require( 'compression' );
const bodyParser = require( 'body-parser' );
const fs = BBPromise.promisifyAll( require( 'fs' ) );
const sUtil = require( './lib/util' );
const packageInfo = require( './package.json' );
const yaml = require( 'js-yaml' );

/**
 * Creates an express app and initialises it
 *
 * @param {Object} options the options to initialise the app with
 * @return {BBPromise} the promise resolving to the app object
 */
function initApp( options ) {
	// the main application object
	const app = express();

	// get the options and make them available in the app
	app.logger = options.logger; // the logging device
	app.metrics = options.metrics; // the metrics
	app.conf = options.config; // this app's config options
	app.info = packageInfo; // this app's package info

	// ensure some sane defaults
	if ( !app.conf.port ) { app.conf.port = 8888; }
	if ( !app.conf.interface ) { app.conf.interface = '0.0.0.0'; }
	if ( app.conf.compression_level === undefined ) { app.conf.compression_level = 3; }
	if ( app.conf.cors === undefined ) { app.conf.cors = '*'; }
	if ( app.conf.csp === undefined ) {
		app.conf.csp =
            "default-src 'self'; object-src 'none'; media-src 'none'; style-src 'self'; script-src 'self'; frame-ancestors 'self'";
	}

	// set outgoing proxy
	if ( app.conf.proxy ) {
		process.env.HTTP_PROXY = app.conf.proxy;
		// if there is a list of domains which should
		// not be proxied, set it
		if ( app.conf.no_proxy_list ) {
			if ( Array.isArray( app.conf.no_proxy_list ) ) {
				process.env.NO_PROXY = app.conf.no_proxy_list.join( ',' );
			} else {
				process.env.NO_PROXY = app.conf.no_proxy_list;
			}
		}
	}

	// set up header whitelisting for logging
	if ( !app.conf.log_header_whitelist ) {
		app.conf.log_header_whitelist = [
			'cache-control', 'content-type', 'content-length', 'if-match',
			'user-agent', 'x-request-id'
		];
	}
	app.conf.log_header_whitelist = new RegExp( `^(?:${app.conf.log_header_whitelist.map( ( item ) => item.trim() ).join( '|' )})$`, 'i' );

	// set up the spec
	if ( !app.conf.spec ) {
		app.conf.spec = `${__dirname}/spec.yaml`;
	}
	if ( app.conf.spec.constructor !== Object ) {
		try {
			app.conf.spec = yaml.safeLoad( fs.readFileSync( app.conf.spec ) );
		} catch ( e ) {
			app.logger.log( 'warn/spec', `Could not load the spec: ${e}` );
			app.conf.spec = {};
		}
	}
	if ( !app.conf.spec.openapi ) {
		app.conf.spec.openapi = '3.0.0';
	}
	if ( !app.conf.spec.info ) {
		app.conf.spec.info = {
			version: app.info.version,
			title: app.info.name,
			description: app.info.description
		};
	}
	app.conf.spec.info.version = app.info.version;
	if ( !app.conf.spec.paths ) {
		app.conf.spec.paths = {};
	}

	// set the CORS, Powered-By, and CSP headers
	app.all( '*', ( req, res, next ) => {
		if ( app.conf.cors !== false ) {
			res.header( 'access-control-allow-origin', app.conf.cors );
			res.header( 'access-control-allow-headers', 'accept, x-requested-with, content-type' );
			res.header( 'access-control-expose-headers', 'etag' );
		}
		if ( app.conf.csp !== false ) {
			res.header( 'x-xss-protection', '1; mode=block' );
			res.header( 'x-content-type-options', 'nosniff' );
			res.header( 'x-frame-options', 'SAMEORIGIN' );
			res.header( 'content-security-policy', app.conf.csp );
			res.header( 'x-content-security-policy', app.conf.csp );
			res.header( 'x-webkit-csp', app.conf.csp );
		}
		if ( app.conf.expose_version !== false ) {
			let poweredBy = `${app.info.name}: ${app.info.version}`;
			if ( app.info.gitHead ) {
				poweredBy += ` (${app.info.gitHead})`;
			}
			res.header( 'x-powered-by', poweredBy );
		}

		sUtil.initAndLogRequest( req, app );
		next();
	} );

	// disable the default X-Powered-By header
	app.set( 'x-powered-by', false );
	// disable the ETag header - users should provide them!
	app.set( 'etag', false );
	// enable compression
	app.use( compression( { level: app.conf.compression_level } ) );
	// use the JSON body parser
	app.use( bodyParser.json() );
	// use the application/x-www-form-urlencoded parser
	app.use( bodyParser.urlencoded( { extended: true } ) );

	return BBPromise.resolve( app );
}

/**
 * Loads all routes declared in routes/ into the app
 *
 * @param {Application} app the application object to load routes into
 * @return {BBPromise} a promise resolving to the app object
 */
function loadRoutes( app ) {
	// get the list of files in routes/
	return fs.readdirAsync( `${__dirname}/routes` ).map( ( fname ) => BBPromise.try( () => {
		// ... and then load each route
		// but only if it's a js file
		if ( !/\.js$/.test( fname ) ) {
			return undefined;
		}
		// import the route file
		const route = require( `${__dirname}/routes/${fname}` );
		return route( app );
	} ).then( ( route ) => {
		if ( route === undefined ) {
			return;
		}
		// check that the route exports the object we need
		if (
			route.constructor !== Object ||
      !route.path || !route.router ||
      !( route.api_version || route.skip_domain )
		) {
			throw new TypeError( `routes/${fname} does not export the correct object!` );
		}
		// wrap the route handlers with Promise.try() blocks
		sUtil.wrapRouteHandlers( route.router );
		// determine the path prefix
		let prefix = '';
		if ( !route.skip_domain ) {
			prefix = `/:domain/v${route.api_version}`;
		}
		// all good, use that route
		app.use( prefix + route.path, route.router );
	} ) ).then( () => {
		// catch errors
		sUtil.setErrorHandler( app );
		// route loading is now complete, return the app object
		return BBPromise.resolve( app );
	} );
}

/**
 * Creates and start the service's web server
 *
 * @param {Application} app the app object to use in the service
 * @return {BBPromise} a promise creating the web server
 */
function createServer( app ) {
	// return a promise which creates an HTTP server,
	// attaches the app to it, and starts accepting
	// incoming client requests
	let server;
	return new BBPromise( ( ( resolve ) => {
		server = http.createServer( app ).listen(
			app.conf.port,
			app.conf.interface,
			resolve
		);
	} ) ).then( () => {
		app.logger.log(
			'info',
			`Worker ${process.pid} listening on ${app.conf.interface}:${app.conf.port}`
		);
		return server;
	} );
}

/**
 * The service's entry point. It takes over the configuration
 * options and the logger- and metrics-reporting objects from
 * service-runner and starts an HTTP server, attaching the application
 * object to it.
 *
 * @param {Object} options
 * @return {BBPromise}
 */
module.exports = function entry( options ) {
	return initApp( options )
		.then( loadRoutes )
		.then( createServer );
};
