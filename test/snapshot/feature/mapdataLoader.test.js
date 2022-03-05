const mockMWApi = require( 'mwapi' );

const mapdataLoader = require( '../../../lib/snapshot/mapdataLoader' );

// Intercept external services
// const mockPreq = require('preq');

describe( 'mapdataLoader', () => {
	test( 'handles success', async () => {
		const groupId = '_1234';
		const pageId = '567';
		const pageTitle = 'Title';
		const mapdata = {
			type: 'Feature',
			properties: {
				'marker-color': 'f00',
			},
			geometry: { type: 'Point', coordinates: [ 0, 0 ] },
		};
		const expectedRequest = {
			action: 'query',
			formatversion: '2',
			mpdlimit: 'max',
			mpdgroups: groupId,
			prop: 'mapdata',
			revids: true,
		};
		const mockResponse = {
			query: {
				pages: [
					{
						pageid: pageId,
						title: pageTitle,
						mapdata: JSON.stringify( {
							[ groupId ]: [ mapdata ],
						} ),
					},
				],
			},
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
} );
