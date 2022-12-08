'use strict';

const preq = require( 'preq' );
const assert = require( '../../utils/assert' );
const Server = require( '../../utils/server' );
const pathTestsJson = require( './test-cases/path-test-provider.json' );

const server = new Server();

function isPng( buffer ) {
	if ( !buffer || buffer.length < 8 ) {
		return false;
	}
	return buffer.toString( 'binary', 0, 8 ) === '\x89PNG\r\n\x1A\n';
}

function constructTestCase( title, serverUri, path, response ) {
	return {
		title,
		request: {
			uri: ( serverUri ) + ( path[ 0 ] === '/' ? path.slice( 1 ) : path ),
			method: 'get',
			followRedirect: false
		},
		response: {
			status: response.status || 200,
			headers: response.headers || {},
			body: response.body
		}
	};
}

function constructTests( paths, serverUri ) {
	const tests = [];
	Object.keys( paths ).forEach( ( pathStr ) => {
		const testCaseData = paths[ pathStr ];
		tests.push( constructTestCase(
			testCaseData.title,
			serverUri,
			pathStr,
			testCaseData.response || {}
		) );
	} );
	return tests;
}

function validateBody( resBody, expBody ) {
	if ( !expBody ) { return; }

	assert.isTrue( !!resBody, 'Missing body' );

	if ( Buffer.isBuffer( resBody ) ) {
		assert.isTrue( resBody.length > 0 );
		if ( expBody.type === 'png' ) {
			assert.isTrue( isPng( resBody ) );
		}
		return;
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

		assert.strictEqual( resHeaders[ key ], expHeaders[ key ], `${key} header mismatch!` );
	} );
}

function validateTestResponse( res, expRes ) {
	assert.status( res, expRes.status );
	validateHeader( res.headers, expRes.headers );
	validateBody( res.body, expRes.body );
}

describe( 'Integration tests', () => {
	jest.setTimeout( 20000 );

	beforeAll( () => server.start() );
	afterAll( () => server.stop() );

	// FIXME: the serverUri should come from server.config.uri but can't be accessed before startup
	constructTests( pathTestsJson, 'http://localhost:6533/' ).forEach( ( testCase ) => {
		it( testCase.title, async () => {
			let res;

			try {
				res = await preq( testCase.request );
			} catch ( err ) {
				res = err;
			}

			validateTestResponse( res, testCase.response );
		} );
	} );
} );
