'use strict';

const preq = require( 'preq' );
const assert = require( '../../utils/assert' );
const Server = require( '../../utils/server' );
const URI = require( 'swagger-router' ).URI;
const OpenAPISchemaValidator = require( 'openapi-schema-validator' ).default;
const yaml = require( 'js-yaml' );
const fs = require( 'fs' );

const validator = new OpenAPISchemaValidator( { version: 2 } );

const server = new Server();

function validateExamples( pathStr, defParams, mSpec ) {
	const uri = new URI( pathStr, {}, true );

	if ( !mSpec ) {
		try {
			uri.expand( defParams );
			return true;
		} catch ( e ) {
			throw new Error( `Missing parameter for route ${pathStr} : ${e.message}` );
		}
	}

	if ( !Array.isArray( mSpec ) ) {
		throw new Error( `Route ${pathStr} : x-amples must be an array!` );
	}

	mSpec.forEach( ( ex, idx ) => {
		if ( !ex.title ) {
			throw new Error( `Route ${pathStr}, example ${idx}: title missing!` );
		}

		ex.request = ex.request || {};
		try {
			uri.expand( Object.assign( {}, defParams, ex.request.params || {} ) );
		} catch ( e ) {
			throw new Error( `Route ${pathStr}, example ${idx} (${ex.title}): missing parameter: ${e.message}` );
		}
	} );

	return true;
}

describe( 'Swagger spec', () => {
	const specYaml = yaml.safeLoad( fs.readFileSync( `${__dirname}/../../../spec.yaml` ) );
	jest.setTimeout( 20000 );

	beforeAll( () => server.start() );
	afterAll( () => server.stop() );

	it( 'should be accessible ', async () => {
		const res = await preq.get( `${server.config.uri}?spec` );
		assert.status( res, 200 );
		assert.contentType( res, 'application/json' );
		assert.notStrictEqual( res.body, undefined, 'No body received!' );
	} );

	it( 'should expose valid OpenAPI spec', () => preq.get( { uri: `${server.config.uri}?spec` } )
		.then( ( res ) => {
			assert.deepEqual( { errors: [] }, validator.validate( res.body ), 'Spec must have no validation errors' );
		} ) );

	it( 'should be valid', () => {
		// check the high-level attributes
		[ 'info', 'swagger', 'paths' ].forEach( ( prop ) => {
			assert.isTrue( !!specYaml[ prop ], `No ${prop} field present!` );
		} );
		// no paths - no love
		assert.isTrue( !!Object.keys( specYaml.paths ), 'No paths given in the spec!' );
		// now check each path
		Object.keys( specYaml.paths ).forEach( ( pathStr ) => {
			assert.isTrue( !!pathStr, 'A path cannot have a length of zero!' );
			const path = specYaml.paths[ pathStr ];
			assert.isTrue( !!Object.keys( path ), `No methods defined for path: ${pathStr}` );
			Object.keys( path ).forEach( ( method ) => {
				const mSpec = path[ method ];
				if ( {}.hasOwnProperty.call( mSpec, 'x-monitor' ) && !mSpec[ 'x-monitor' ] ) {
					return;
				}
				validateExamples( pathStr, specYaml[ 'x-default-params' ] || {}, mSpec[ 'x-amples' ] );
			} );
		} );
	} );
} );
