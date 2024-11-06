'use strict';
const preq = require( 'preq' );
const assert = require( '../../utils/assert' );
const Server = require( '../../utils/server' );
const OpenAPISchemaValidator = require( 'openapi-schema-validator' ).default;
const yaml = require( 'js-yaml' );
const fs = require( 'fs' );

const validator = new OpenAPISchemaValidator( { version: 3 } );

const server = new Server();

describe( 'OpenAPI spec', () => {
	const specYaml = yaml.load( fs.readFileSync( `${ __dirname }/../../../spec.yaml` ) );
	jest.setTimeout( 20000 );

	beforeAll( () => server.start() );
	afterAll( () => server.stop() );

	it( 'should be accessible ', async () => {
		const res = await preq.get( `${ server.config.uri }?spec` );
		assert.status( res, 200 );
		assert.contentType( res, 'application/json' );
		assert.notStrictEqual( res.body, undefined, 'No body received!' );
	} );

	it( 'should expose valid OpenAPI spec', () => preq.get( { uri: `${ server.config.uri }?spec` } )
		.then( ( res ) => {
			assert.deepEqual( validator.validate( res.body ), { errors: [] }, 'Spec must have no validation errors' );
		} ) );

	it( 'should be valid', () => {
		// check the high-level attributes
		[ 'info', 'openapi', 'paths' ].forEach( ( prop ) => {
			assert.isTrue( !!specYaml[ prop ], `No ${ prop } field present!` );
		} );
		// no paths - no love
		assert.isTrue( !!Object.keys( specYaml.paths ), 'No paths given in the spec!' );
		// now check each path
		Object.keys( specYaml.paths ).forEach( ( pathStr ) => {
			assert.isTrue( !!pathStr, 'A path cannot have a length of zero!' );
			const path = specYaml.paths[ pathStr ];
			assert.isTrue( !!Object.keys( path ), `No methods defined for path: ${ pathStr }` );
			Object.keys( path ).forEach( ( method ) => {
				const mSpec = path[ method ];
				if ( {}.hasOwnProperty.call( mSpec, 'x-monitor' ) && !mSpec[ 'x-monitor' ] ) {
					return;
				}
			} );
		} );
	} );
} );
