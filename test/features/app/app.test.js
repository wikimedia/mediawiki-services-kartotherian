'use strict';

const preq = require( 'preq' );
const rp = require( 'request-promise' );
const assert = require( '../../utils/assert' );
const Server = require( '../../utils/server' );

const server = new Server();

describe( 'express app', () => {
	jest.setTimeout( 20000 );

	beforeAll( () => server.start() );
	afterAll( () => server.stop() );

	it( 'should get robots.txt', () => preq.get( {
		uri: `${server.config.uri}robots.txt`
	}, 20000 ).then( ( res ) => {
		assert.status( res, 200 );
		assert.strictEqual( res.body, 'User-agent: *\nDisallow: /' );
	} ) );

	it( 'should set CORS headers', () => {
		if ( server.config.service.conf.cors === false ) {
			return true;
		}
		return preq.get( {
			uri: `${server.config.uri}robots.txt`
		} ).then( ( res ) => {
			assert.status( res, 200 );
			assert.strictEqual( res.headers[ 'access-control-allow-origin' ], '*' );
			assert.isTrue( !!res.headers[ 'access-control-allow-headers' ] );
			assert.isTrue( !!res.headers[ 'access-control-expose-headers' ] );
		} );
	}, 20000 );

	it( 'should set CSP headers', () => preq.get( {
		uri: `${server.config.uri}robots.txt`
	} ).then( ( res ) => {
		const cspHeader = "default-src 'self'; object-src 'none'; media-src 'none'; style-src 'self'; script-src 'self'; frame-ancestors 'self'";
		assert.status( res, 200 );
		assert.strictEqual( res.headers[ 'x-xss-protection' ], '1; mode=block' );
		assert.strictEqual( res.headers[ 'x-content-type-options' ], 'nosniff' );
		assert.strictEqual( res.headers[ 'x-frame-options' ], 'SAMEORIGIN' );
		assert.strictEqual( res.headers[ 'content-security-policy' ], cspHeader );
		assert.strictEqual( res.headers[ 'x-content-security-policy' ], cspHeader );
		assert.strictEqual( res.headers[ 'x-webkit-csp' ], cspHeader );
	} ), 20000 );

	it( 'should get static content gzipped', () => rp( {
		uri: `${server.config.uri}index.html`,
		headers: {
			'accept-encoding': 'gzip, deflate'
		},
		resolveWithFullResponse: true
	}, 20000 ).then( ( res ) => {
		// check that the response is gzip-ed
		assert.strictEqual( res.headers[ 'content-encoding' ], 'gzip', 'Expected gzipped contents!' );
	} ) );

	it( 'should get static content uncompressed', () => rp( {
		uri: `${server.config.uri}index.html`,
		headers: {
			'accept-encoding': ''
		},
		resolveWithFullResponse: true
	}, 20000 ).then( ( res ) => {
		// check that the response is gzip-ed
		assert.isUndefined( res.headers[ 'content-encoding' ], 'Did not expect gzipped contents!' );
	} ) );
} );
