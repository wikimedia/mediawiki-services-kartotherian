'use strict';

const yaml = require( 'js-yaml' );
const fs = require( 'fs' );
const packageInfo = require( '../../package.json' );
const BBPromise = require( 'bluebird' );
const Err = require( '../err' );
const postgres = require( 'pg-promise' )( { promiseLib: BBPromise } );
const GeoShapes = require( './geoshapes' );

/**
 * Web server (express) route handler to get geoshapes
 *
 * @param {Object} core
 * @param {Object} config
 * @param {string} type
 * @param {Object} req request object
 * @param {Object} req.query request object's query
 * @param {Object} res response object
 * @param {Function} next will be called if request is not handled
 * @return {BBPromise}
 */
function handler( core, config, type, req, res, next ) {
	const shape = new GeoShapes( config );
	const lowerHeaders = Object.keys( req.headers ).reduce( ( newHeaders, key ) => {
		newHeaders[ key.toLowerCase() ] = req.headers[ key ];
		return newHeaders;
	}, {} );

	return BBPromise.try( () =>
		shape.execute( type, req.query, lowerHeaders[ 'x-client-ip' ], core.metrics )
	).then( ( geodata ) => {
		core.setResponseHeaders( res );
		res.type( 'application/vnd.geo+json' ).json( geodata );
	} ).catch( ( err ) => core.reportRequestError( err, res ) ).catch( next );
}

function loadServiceConfig( core ) {
	return BBPromise.try( () => {
		const config = core.getConfiguration().geoshapes;

		// TODO: we shouldn't use it directly,
		// but instead refactor out mwapi lib from node_service_template
		// and use the proper host
		const mwapi = core.getConfiguration().mwapi_req;
		config.mwapi = ( mwapi && mwapi.uri ) || 'https://en.wikipedia.org/w/api.php';

		const contact = core.getConfiguration().userAgentContact || '';
		config.userAgent = `${packageInfo.name}/${packageInfo.version} ${contact}`.trim();

		// Load queries from yaml file
		config.queries = yaml.load( fs.readFileSync( `${__dirname}/queries.yaml`, 'utf8' ) );
		return config;
	} );
}

function loadDBHandler( config ) {
	return BBPromise.try( () => {
		if ( !config.database || !/^[a-zA-Z][a-zA-Z0-9]*$/.test( config.database ) ) {
			throw new Err( '"geoshapes" parameters must specify "database"' );
		}

		config.db = postgres( {
			host: config.host,
			port: config.port,
			database: config.database,
			user: config.user,
			password: config.password,
			application_name: 'geoshapes',
			poolSize: config.poolSize || 10
		} );

		return config;
	} );
}

function checkValidStructure( config ) {
	// Check the valid structure of the table - use invalid id
	const shape = new GeoShapes( config );
	return BBPromise.all( [
		shape.execute( 'geoshape', { ids: 'Q123456789' } ),
		shape.execute( 'geoline', { ids: 'Q123456789' } )
	] ).then( () => config );
}

function initService( config ) {
	return BBPromise.try( () => {
		if ( !config ) {
			throw new Err( '"geoshapes" parameter block is not set up in the config' );
		}
		if ( !config.wikidataQueryService ) {
			throw new Err( '"geoshapes" parameters must specify "wikidataQueryService"' );
		}

		config.sparqlHeaders = {
			'User-Agent': config.userAgent,
			Accept: 'application/sparql-results+json'
		};

		config.mwapiHeaders = {
			'User-Agent': config.userAgent,
			Host: 'en.wikipedia.org'
		};

		config.maxidcount = config.maxidcount !== undefined ?
			parseInt( config.maxidcount, 10 ) : 500;
		if ( config.maxidcount <= 0 ) {
			throw new Err( '"geoshapes.maxidcount" must be a positive integer' );
		}

		// Which query to use by default
		const defaultQ = config.queries.simplifyarea;

		if ( config.allowUserQueries ) {
			config.queries.default = defaultQ;
		} else {
			// Delete all queries except the default one, and remove parameter
			// names to prevent user parameters
			config.queries = { default: defaultQ };
			if ( defaultQ.params ) {
				defaultQ.params.forEach( ( param ) => {
					delete param.name;
				} );
			}
		}

		return config;
	} );
}

module.exports = ( core, router ) => {
	loadServiceConfig( core )
		.then( loadDBHandler )
		.then( initService )
		.then( checkValidStructure )
		.then( ( config ) => { // Load routes
			router.get( '/shape', ( req, res, next ) => handler( core, config, 'geoshape', req, res, next ) ); // obsolete
			router.get( '/geoshape', ( req, res, next ) => handler( core, config, 'geoshape', req, res, next ) );
			router.get( '/geoline', ( req, res, next ) => handler( core, config, 'geoline', req, res, next ) );
			// T302297 temporary feature flag TODO: remove feature flag once geopoints will stay
			if ( config.enableGeopoints === true ) {
				router.get( '/geopoint', ( req, res, next ) => handler( core, config, 'geopoint', req, res, next ) );
			}
		} )
		.catch( ( err ) => {
			core.log( 'error', `geoshapes support failed to load, skipping: ${err}\n${err.stack}` );
			// still allow loading
		} );
};
