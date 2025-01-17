'use strict';

const { downloadMapdata: mapdataLoader } =
	require( '../../../lib/snapshot/mapdataLoader' );
const { Template } = require( 'swagger-router' );

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
			format: 'json',
			mpdlimit: 'max',
			mpdgroups: [ groupId ],
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

		const mwApiRequest = jest.fn().mockResolvedValue( { status: 200, body: mockResponse } );
		const mockRequest = {
			app: {
				mwapi_tpl: new Template( {
					method: 'POST',
					uri: 'http://{{domain}}/w/api.php',
					headers: '{{request.headers}}',
					body: '{{ default(request.query, {}) }}'
				} )
			},
			issueRequest: mwApiRequest,
			headers: {}
		};

		expect(
			mapdataLoader(
				mockRequest, 'https', 'api.test', pageTitle, false, groupId, ''
			)
		).resolves.toStrictEqual( mapdata );
		expect( mwApiRequest ).toHaveBeenCalledWith(
			expect.objectContaining( { body: expectedRequest } )
		);
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

		const mwApiRequest = jest.fn().mockResolvedValue( { status: 200, body: mockResponse } );
		const mockRequest = {
			app: {
				mwapi_tpl: new Template( {
					method: 'POST',
					uri: 'http://{{domain}}/w/api.php',
					headers: '{{request.headers}}',
					body: '{{ default(request.query, {}) }}'
				} )
			},
			issueRequest: mwApiRequest,
			headers: {},
			logger: { log: jest.fn() }
		};

		expect(
			mapdataLoader(
				mockRequest, 'https', 'api.test', pageTitle, false, groupId, ''
			)
		).rejects.toThrow( 'Invalid mapdata response' );
	} );

	test( 'handles API exception', () => {
		const error = 'api-error';
		const mwApiRequest = jest.fn().mockResolvedValue( { status: 500, body: error } );
		const mockRequest = {
			app: {
				mwapi_tpl: new Template( {
					method: 'POST',
					uri: 'http://{{domain}}/w/api.php',
					headers: '{{request.headers}}',
					body: '{{ default(request.query, {}) }}'
				} )
			},
			issueRequest: mwApiRequest,
			headers: {},
			logger: { log: jest.fn() }
		};

		expect(
			mapdataLoader(
				mockRequest, 'https', 'api.test', pageTitle, false, groupId, ''
			)
		).rejects.toThrow( '500: api_error' );
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

		const mwApiRequest = jest.fn().mockResolvedValue( { status: 200, body: mockResponse } );
		const mockRequest = {
			app: {
				mwapi_tpl: new Template( {
					method: 'POST',
					uri: 'http://{{domain}}/w/api.php',
					headers: '{{request.headers}}',
					body: '{{ default(request.query, {}) }}'
				} )
			},
			issueRequest: mwApiRequest,
			headers: {},
			logger: { log: jest.fn() }
		};

		expect(
			mapdataLoader(
				mockRequest, 'https', 'api.test', pageTitle, false, groupId, ''
			)
		).rejects.toThrow( 'Bad GeoJSON - is null' );
	} );

	test( 'skips failed groups', () => {
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

		const mwApiRequest = jest.fn().mockResolvedValue( { status: 200, body: mockResponse } );
		const mockRequest = {
			app: {
				mwapi_tpl: new Template( {
					method: 'POST',
					uri: 'http://{{domain}}/w/api.php',
					headers: '{{request.headers}}',
					body: '{{ default(request.query, {}) }}'
				} )
			},
			issueRequest: mwApiRequest,
			headers: {},
			logger: { log: jest.fn() }
		};

		expect(
			mapdataLoader(
				mockRequest, 'https', 'api.test', pageTitle, false, [ 'bad', groupId ], ''
			)
		).resolves.toStrictEqual( mapdata );
	} );
} );
