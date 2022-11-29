'use strict';

const preq = require( 'preq' );
const assert = require( '../../utils/assert' );
const Server = require( '../../utils/server' );
const URI = require( 'swagger-router' ).URI;
const OpenAPISchemaValidator = require( 'openapi-schema-validator' ).default;
const yaml = require( 'js-yaml' );
const fs = require( 'fs' );

const validator = new OpenAPISchemaValidator( { version: 2 } );

let spec = null;
let baseUrl = null;
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

function constructTestCase( title, path, method, request, response ) {
	return {
		title,
		request: {
			uri: ( baseUrl || 'http://localhost:6533/' ) + ( path[ 0 ] === '/' ? path.slice( 1 ) : path ),
			method,
			headers: request.headers || {},
			query: request.query,
			body: request.body,
			followRedirect: false
		},
		response: {
			status: response.status || 200,
			headers: response.headers || {},
			body: response.body
		}
	};
}

function constructTests( appSpec ) {
	const ret = [];
	const paths = appSpec.paths;
	const defParams = appSpec[ 'x-default-params' ] || {};

	Object.keys( paths ).forEach( ( pathStr ) => {
		Object.keys( paths[ pathStr ] ).forEach( ( method ) => {
			const p = paths[ pathStr ][ method ];
			if ( {}.hasOwnProperty.call( p, 'x-monitor' ) && !p[ 'x-monitor' ] ) {
				return;
			}
			const uri = new URI( pathStr, {}, true );
			if ( !p[ 'x-amples' ] ) {
				ret.push( constructTestCase(
					pathStr,
					uri.toString( { params: defParams } ),
					method,
					{},
					{}
				) );
				return;
			}
			p[ 'x-amples' ].forEach( ( ex ) => {
				ex.request = ex.request || {};
				ret.push( constructTestCase(
					ex.title,
					uri.toString( {
						params: Object.assign(
							{},
							defParams,
							ex.request.params || {}
						)
					} ),
					method,
					ex.request,
					ex.response || {}
				) );
			} );
		} );
	} );

	return ret;
}

function validateBody( resBody, expBody ) {
	if ( !expBody ) { return; }

	assert.isTrue( !!resBody, 'Missing body' );

	if ( Buffer.isBuffer( resBody ) ) {
		resBody = resBody.toString();
	}

	if ( expBody.constructor !== resBody.constructor ) {
		if ( expBody.constructor === String ) {
			resBody = JSON.stringify( resBody );
		} else {
			resBody = JSON.parse( resBody );
		}
	}

	assert.deepEqual( resBody, expBody );
}

function validateHeader( resHeaders, expHeaders ) {
	if ( !expHeaders ) { return; }

	assert.isTrue( !!resHeaders, 'Missing headers' );

	Object.keys( expHeaders ).forEach( ( key ) => {
		assert.isTrue(
			{}.hasOwnProperty.call( resHeaders, key ),
			`Header ${key} not found in response!`
		);

		assert.deepEqual( resHeaders[ key ], expHeaders[ key ], `${key} header mismatch!` );
	} );
}

function validateTestResponse( res, expRes ) {
	assert.deepEqual( res.status, expRes.status );
	validateHeader( res.headers, expRes.headers );
	validateBody( res.body, expRes.body );
}

describe( 'Swagger spec', () => {
	jest.setTimeout( 20000 );
	spec = yaml.safeLoad( fs.readFileSync( `${__dirname}/../../../spec.yaml` ) );

	beforeAll( () => server.start() );
	afterAll( () => server.stop() );

	it( 'get the spec', async () => {
		baseUrl = server.config.uri;
		const res = await preq.get( `${baseUrl}?spec` );
		assert.status( res, 200 );
		assert.contentType( res, 'application/json' );
		assert.notDeepEqual( res.body, undefined, 'No body received!' );
	} );

	describe( 'test spec x-amples', () => {
		constructTests( spec ).forEach( ( testCase ) => {
			it( testCase.title, async () => {
				let res;

				try {
					// preq seems to expect a decoded URI
					testCase.request.uri = decodeURIComponent( testCase.request.uri );
					res = await preq( testCase.request );
				} catch ( err ) {
					res = err;
				}

				validateTestResponse( res, testCase.response );
			} );
		} );
	} );

	it( 'should expose valid OpenAPI spec', () => preq.get( { uri: `${server.config.uri}?spec` } )
		.then( ( res ) => {
			assert.deepEqual( { errors: [] }, validator.validate( res.body ), 'Spec must have no validation errors' );
		} ) );

	it( 'spec validation', () => {
		// check the high-level attributes
		[ 'info', 'swagger', 'paths' ].forEach( ( prop ) => {
			assert.deepEqual( !!spec[ prop ], true, `No ${prop} field present!` );
		} );
		// no paths - no love
		assert.deepEqual( !!Object.keys( spec.paths ), true, 'No paths given in the spec!' );
		// now check each path
		Object.keys( spec.paths ).forEach( ( pathStr ) => {
			assert.deepEqual( !!pathStr, true, 'A path cannot have a length of zero!' );
			const path = spec.paths[ pathStr ];
			assert.deepEqual( !!Object.keys( path ), true, `No methods defined for path: ${pathStr}` );
			Object.keys( path ).forEach( ( method ) => {
				const mSpec = path[ method ];
				if ( {}.hasOwnProperty.call( mSpec, 'x-monitor' ) && !mSpec[ 'x-monitor' ] ) {
					return;
				}
				validateExamples( pathStr, spec[ 'x-default-params' ] || {}, mSpec[ 'x-amples' ] );
			} );
		} );
	} );
} );
