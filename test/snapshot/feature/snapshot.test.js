'use strict';

/**
 * Test whether the mapdata API requests are correct for what was requested.
 */

// Intercept MWApi calls.
jest.mock( 'mwapi' );
const MWApi = require( 'mwapi' );

const mwapiExecute = jest.fn();
MWApi.mockImplementation( () => ( {
	execute: mwapiExecute
} ) );

const callSnapshot = require( '../utils/callSnapshot' );

const overlayQueryParams = {
	domain: 'localhost',
	groups: 'a,b',
	title: 'Example'
};

const unversionedRequest = {
	action: 'query',
	formatversion: '2',
	mpdgroups: 'a|b',
	mpdlimit: 'max',
	prop: 'mapdata',
	titles: 'Example'
};

const versionedRequest = {
	action: 'query',
	formatversion: '2',
	mpdgroups: 'a|b',
	mpdlimit: 'max',
	prop: 'mapdata',
	revids: '123'
};

beforeEach( () => mwapiExecute.mockClear() );

// TODO: Should also test that there were no errors and the returned "next"
// function wasn't called.

describe( 'unversioned mapdata request', () => {
	test( 'uses page title when revid parameter is absent', async () => {
		await callSnapshot( { versioned_maps: false }, overlayQueryParams );
		expect( mwapiExecute ).toHaveBeenCalledWith( unversionedRequest );
	} );

	test( 'versioned feature config doesn\'t affect legacy query', async () => {
		await callSnapshot( { versioned_maps: true }, overlayQueryParams );
		expect( mwapiExecute ).toHaveBeenCalledWith( unversionedRequest );
	} );
} );

describe( 'versioned mapdata request', () => {
	test( 'passes through revid parameter when versioned feature enabled', async () => {
		await callSnapshot( { versioned_maps: true }, { revid: '123', ...overlayQueryParams } );
		expect( mwapiExecute ).toHaveBeenCalledWith( versionedRequest );
	} );

	test( 'ignores revid parameter when versioned feature disabled', async () => {
		await callSnapshot( { versioned_maps: false }, { revid: '123', ...overlayQueryParams } );
		expect( mwapiExecute ).toHaveBeenCalledWith( unversionedRequest );
	} );
} );

describe( 'domain handling', () => {
	test( 'strips protocol and port before validation', async () => {
		await callSnapshot( {}, {
			domain: 'http://localhost:1234',
			title: 'Example',
			groups: 'a,b'
		} );
		expect( mwapiExecute ).toHaveBeenCalledWith( unversionedRequest );
	} );

	test( 'rejects unknown domain', async () => {
		await callSnapshot( {}, {
			domain: 'nasty.invalid',
			title: 'Example',
			groups: 'a,b'
		} );
		expect( mwapiExecute ).not.toHaveBeenCalled();
	} );
} );

describe( 'no overlay handling', () => {
	test( 'does not try to get data when no domain set', async () => {
		await callSnapshot( {}, {
			title: 'Example',
			groups: 'a,b'
		} );
		expect( mwapiExecute ).not.toHaveBeenCalled();
	} );

	test( 'does not try to get data when no title set', async () => {
		await callSnapshot( {}, {
			domain: 'localhost',
			groups: 'a,b'
		} );
		expect( mwapiExecute ).not.toHaveBeenCalled();
	} );
} );
