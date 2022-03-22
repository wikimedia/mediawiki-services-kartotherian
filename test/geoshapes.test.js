const GeoShapes = require( '../lib/geoshapes/geoshapes' );

// Intercept external services
const mockPreq = require( 'preq' );

describe( 'constructor', () => {
	test( 'errors on empty params', () => {
		expect( () => new GeoShapes( 'geoshape', {}, {} ) )
			.toThrowError( 'must be given' );
	} );

	test( 'handles multiple and blank IDs', () => {
		const shape = new GeoShapes( 'geoshape', { ids: 'Q123,,Q456' }, {} );
		expect( shape.ids ).toStrictEqual( [ 'Q123', 'Q456' ] );
	} );

	test( 'rejects non-Q-IDs', () => {
		expect( () => new GeoShapes( 'geoshape', { ids: 'A1' }, {} ) )
			.toThrowError( 'Invalid' );
	} );
} );

describe( 'runWikidataQuery', () => {
	test( 'ignores IDs request', () => {
		const shape = new GeoShapes( 'geoshape', { ids: 'Q123' }, {} );
		expect( shape._runWikidataQuery() ).toBe( undefined );
	} );

	test( 'makes sparql query', () => {
		const uri = 'https://wdqs.test';
		const sparqlQuery = 'SELECT $1~ $2.csv $3';
		const preqResult = {
			headers: {
				'content-type': 'application/sparql-results+json'
			},
			body: {
				results: {
					bindings: [
						{
							id: {
								type: 'uri',
								value: 'http://www.wikidata.org/entity/Q321'
							},
							fill: {
								type: 'literal',
								value: '#f00'
							}
						}
					]
				}
			}
		};
		const shape = new GeoShapes( 'geoshape', { query: sparqlQuery }, { sparqlHeaders: { 'X-Test': 'yes' }, wikidataQueryService: uri } );
		const returnedPromise = {
			then: jest.fn( ( result ) => {
				result( preqResult );
				expect( shape.ids ).toStrictEqual( [ 'Q321' ] );
			} )
		};
		mockPreq.get = jest.fn( () => returnedPromise );

		shape._runWikidataQuery( '127.0.0.1' );

		expect( returnedPromise.then ).toHaveBeenCalled();
		expect( mockPreq.get ).toHaveBeenCalledWith( {
			uri,
			query: {
				format: 'json',
				query: sparqlQuery
			},
			headers: { 'X-Test': 'yes', 'X-Client-IP': '127.0.0.1' }
		} );
		expect( shape.rawProperties ).toStrictEqual( { Q321: { fill: { type: 'literal', value: '#f00' } } } );
	} );
} );

describe( 'runSqlQuery', () => {
	test( 'ignores sparql query', () => {
		const shape = new GeoShapes( 'geoshape', { query: 'dummy' }, { wikidataQueryService: true } );
		expect( shape._runSqlQuery() ).toBe( undefined );
	} );

	test( 'formats query', () => {
		const dummyRows = [ 'rows' ];
		const returnedPromise = {
			then: jest.fn( ( cb ) => cb( dummyRows ) )
		};
		const mockDb = { query: jest.fn( () => returnedPromise ) };
		const sqlQuery = 'SELECT $1~ $2:csv $3';
		const shape = new GeoShapes(
			'geoshape',
			{ ids: 'Q123,Q456' },
			{
				db: mockDb,
				polygonTable: 'polys',
				queries: { default: { sql: sqlQuery } }
			}
		);

		shape._runSqlQuery();

		expect( mockDb.query ).toHaveBeenCalledWith( sqlQuery, [ 'polys', [ 'Q123', 'Q456' ] ] );
		expect( shape.geoRows ).toStrictEqual( dummyRows );
	} );
} );

describe( 'expandProperties', () => {
	test( 'handles empty list', () => {
		const shape = new GeoShapes( 'geoshape', { ids: 'Q123' }, {} );
		mockPreq.post = jest.fn();
		shape._expandProperties();
		expect( mockPreq.post ).not.toHaveBeenCalled();
	} );

	test( 'maps and posts', () => {
		const basicProperties = [ {
			type: 'Feature',
			id: 'Q123',
			properties: {
				fill: '#f00'
			},
			geometry: { type: 'Point', coordinates: [ 0, 0 ] }
		} ];
		const preqResult = {
			headers: {
				'content-type': 'application/sparql-results+json'
			},
			body: {
				'sanitize-mapdata': {
					sanitized: JSON.stringify( [ {
						id: 'Q123',
						properties: basicProperties
					} ] )
				}
			}
		};
		const returnedPromise = {
			then: jest.fn( ( cb ) => cb( preqResult ) )
		};
		mockPreq.post = jest.fn( () => returnedPromise );
		const apiUrl = 'https://api.test';
		const shape = new GeoShapes( 'geoshape', { ids: 'Q123' }, { mwapi: apiUrl } );
		shape.rawProperties = {
			Q123: {
				fill: {
					type: 'literal',
					value: '#f00'
				}
			}
		};

		shape._expandProperties();

		expect( mockPreq.post ).toHaveBeenCalledWith( {
			formData: {
				action: 'sanitize-mapdata',
				format: 'json',
				formatversion: 2,
				text: JSON.stringify( basicProperties )
			},
			headers: undefined,
			uri: apiUrl
		} );
		expect( returnedPromise.then ).toHaveBeenCalled();
		expect( shape.cleanProperties ).toStrictEqual( {
			Q123: basicProperties
		} );
		expect( shape.ids ).toStrictEqual( [ 'Q123' ] );
	} );
} );

describe( 'wrapResult', () => {
	test( 'converts point to geojson', () => {
		const shape = new GeoShapes( 'geoshape', { query: 'dummy' }, { wikidataQueryService: true } );

		shape.geoRows = [
			{
				id: 'dummy',
				data: JSON.stringify( {
					type: 'Point',
					coordinates: [ 0, 0 ]
				} )
			}
		];
		const result = shape._wrapResult();
		const expectedResult = {
			type: 'Topology',
			objects: {
				data: {
					type: 'GeometryCollection',
					geometries: [
						{
							coordinates: [
								0,
								0
							],
							id: 'dummy',
							properties: {},
							type: 'Point'
						}
					]
				}
			},
			arcs: [],
			bbox: [ 0, 0, 0, 0 ]
		};
		expect( result ).toStrictEqual( expectedResult );
	} );
} );
