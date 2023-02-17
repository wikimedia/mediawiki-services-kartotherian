'use strict';

const { downloadMapdata: mapdataLoader } =
	require( '../../../lib/snapshot/mapdataLoader' );

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
			titles: pageTitle
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
		const mwApiExecute = jest.fn()
			.mockResolvedValue( mockResponse );
		const MWApi = jest.fn()
			.mockReturnValue( { execute: mwApiExecute } );

		expect( mapdataLoader( {}, 'https', 'api.test', pageTitle, false, groupId, '', MWApi ) )
			.resolves.toStrictEqual( mapdata );
		expect( mwApiExecute ).toHaveBeenCalledWith( expectedRequest );
	} );

	// Page is missing, no GeoJSON present, or Kartographer mapdata API is disabled.
	test( 'handles missing mapdata', () => {
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
		const mwApiExecute = jest.fn()
			.mockResolvedValue( mockResponse );
		const MWApi = jest.fn()
			.mockReturnValue( { execute: mwApiExecute } );
		const req = { logger: { log: jest.fn() } };

		expect( mapdataLoader( req, 'https', 'api.test', pageTitle, false, groupId, '', MWApi ) )
			.rejects.toThrow( 'Invalid mapdata response' );
	} );

	test( 'handles API exception', () => {
		const error = 'mwapi-test-error';
		const req = { logger: { log: jest.fn() } };
		const mwApiExecute = jest.fn()
			.mockRejectedValue( new Error( error ) );
		const MWApi = jest.fn()
			.mockReturnValue( { execute: mwApiExecute } );

		expect( mapdataLoader( req, 'https', 'api.test', pageTitle, false, groupId, '', MWApi ) )
			.rejects.toThrow( error );
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
		const mwApiExecute = jest.fn()
			.mockResolvedValue( mockResponse );
		const MWApi = jest.fn()
			.mockReturnValue( { execute: mwApiExecute } );

		expect( mapdataLoader( {}, 'https', 'api.test', pageTitle, false, groupId, '', MWApi ) )
			.rejects.toThrow( 'Bad GeoJSON - is null' );
	} );

	test( 'skips failed groups', () => {
		const req = { logger: { log: jest.fn() } };
		const mapdata = {
			properties: {},
			type: 'Feature'
		};
		const mockResponse = {
			query: {
				pages: [
					{
						pageid: pageId,
						title: pageTitle,
						mapdata: JSON.stringify( {
							bad: null,
							[ groupId ]: [ mapdata ]
						} )
					}
				]
			}
		};
		const mwApiExecute = jest.fn()
			.mockResolvedValue( mockResponse );
		const MWApi = jest.fn()
			.mockReturnValue( { execute: mwApiExecute } );

		expect( mapdataLoader( req, 'https', 'api.test', pageTitle, false, [ 'bad', groupId ], '', MWApi ) )
			.resolves.toStrictEqual( mapdata );
	} );
} );
