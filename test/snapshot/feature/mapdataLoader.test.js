'use strict';

const mockMWApi = require( 'mwapi' );
const mapdataLoader = require( '../../../lib/snapshot/mapdataLoader' );

// Intercept external services
// const mockPreq = require('preq');

describe( 'mapdataLoader', () => {
	const groupId = '_1234';
	const pageId = '567';
	const pageTitle = 'Title';

	test( 'handles success', async () => {
		const mapdata = {
			type: 'Feature',
			properties: {
				'marker-color': 'f00'
			},
			geometry: { type: 'Point', coordinates: [ 0, 0 ] }
		};
		const expectedRequest = {
			action: 'query',
			formatversion: '2',
			mpdlimit: 'max',
			mpdgroups: groupId,
			prop: 'mapdata',
			revids: true
		};
		const mockResponse = {
			query: {
				pages: [
					{
						pageid: pageId,
						title: pageTitle,
						mapdata: JSON.stringify( {
							[ groupId ]: [ mapdata ]
						} )
					}
				]
			}
		};
		// TODO: Could also test mwapi wiring in only one case, otherwise stash the
		// mock response in clientData.
		mockMWApi.prototype.execute = jest.fn( ( req ) => {
			expect( req ).toStrictEqual( expectedRequest );
			return { then: jest.fn( ( cb ) => cb( mockResponse ) ) };
		} );

		await mapdataLoader( null, 'https', 'api.test', pageTitle, true, groupId )
			.then( ( geojson ) => {
				expect( geojson ).toStrictEqual( mapdata );
			} );
	} );

	// Page is missing, no geojson present, or Kartographer mapdata API is disabled.
	test( 'handles missing mapdata', async () => {
		const mockResponse = {
			query: {
				pages: [
					{
						pageid: pageId,
						title: pageTitle,
						missing: true
					}
				]
			}
		};
		mockMWApi.prototype.execute = jest.fn( () => ( {
			then: jest.fn( ( cb ) => cb( mockResponse ) )
		} ) );
		const req = { logger: { log: jest.fn() } };

		await mapdataLoader( req, 'https', 'api.test', pageTitle, true, groupId )
			.then( ( geojson ) => {
				expect( geojson ).toStrictEqual( { features: [], type: 'FeatureCollection' } );
			} );
	} );

	test( 'handles API exception', async () => {
		const error = 'mwapi-test-error';
		const req = { logger: { log: jest.fn() } };
		mockMWApi.prototype.execute = jest.fn( () => ( {
			then: jest.fn( () => { throw new Error( error ); } )
		} ) );

		expect( () => mapdataLoader( req, 'https', 'api.test', pageTitle, true, groupId ) )
			.toThrowError( error );
	} );

	test( 'handles null mapdata', async () => {
		// FIXME: Capture a more realistic fixture causing these errors.
		const mockResponse = {
			query: {
				pages: [
					{
						pageid: pageId,
						title: pageTitle,
						mapdata: JSON.stringify( {
							[ groupId ]: [ null ]
						} )
					}
				]
			}
		};
		mockMWApi.prototype.execute = jest.fn( () => ( {
			then: jest.fn( ( cb ) => cb( mockResponse ) )
		} ) );

		expect( () => mapdataLoader( null, 'https', 'api.test', pageTitle, true, groupId ) )
			.rejects.toThrow( 'Bad geojson - unknown type object' );
	} );
} );
