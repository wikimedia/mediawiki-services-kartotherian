'use strict';

const pathLib = require( 'path' );
const Promise = require( 'bluebird' );
const core = require( '../lib/core' );
const server = require( '../lib/server' );

function startup( app ) {
	return startup.bootstrap( app ).then( () => {
		const sources = new core.Sources();
		return sources.init( app.conf );
	} ).then( ( sources ) => {
		core.setSources( sources );
		return server.init( {
			core,
			app,
			// eslint-disable-next-line security/detect-non-literal-require
			requestHandlers: app.conf.requestHandlers.map( ( rh ) => require( rh ) )
		} );
	} ).return(); // avoid app.js's default route initialization
}

startup.bootstrap = function bootstrap( app ) {
	return Promise.try( () => {
		core.init(
			app, pathLib.resolve( __dirname, '..' ),
			// eslint-disable-next-line security/detect-non-literal-require
			( module ) => require( module ),
			( module ) => require.resolve( module )
		);
	} );
};

module.exports = startup;
