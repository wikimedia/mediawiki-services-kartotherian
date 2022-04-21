'use strict';

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

describe( 'createPointsSparqlQuery', () => {
	test( 'creates an sparql query for geopoints', async () => {
		const shape = new GeoShapes(
			'geopoint',
			{ ids: 'Q123,Q456' },
			{ coordinatePredicateId: 'wdt:P625' }
		);
		const expectedQuery = 'SELECT ?id ?geo WHERE { VALUES ?id { wd:Q123 wd:Q456 } ?id wdt:P625 ?geo }';
		expect( await shape._createPointsSparqlQuery( shape.ids ) ).toStrictEqual( expectedQuery );
	} );
} );

describe( 'runWikidataQuery', () => {
	test( 'ignores geoshape IDs request', async () => {
		const shape = new GeoShapes( 'geoshape', { ids: 'Q123' }, {} );
		expect( await shape._runWikidataQuery() ).toStrictEqual( {} );
	} );

	test( 'makes sparql query', async () => {
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
			} )
		};
		mockPreq.get = jest.fn( () => returnedPromise );

		const result = await shape._runWikidataQuery( '127.0.0.1' );
		expect( result ).toStrictEqual( {
			Q321: { fill: { type: 'literal', value: '#f00' } } }
		);

		expect( returnedPromise.then ).toHaveBeenCalled();
		expect( mockPreq.get ).toHaveBeenCalledWith( {
			uri,
			query: {
				format: 'json',
				query: sparqlQuery
			},
			headers: { 'X-Test': 'yes', 'X-Client-IP': '127.0.0.1' }
		} );
	} );
} );

describe( 'runSqlQuery', () => {
	test( 'ignores sparql query', async () => {
		const shape = new GeoShapes( 'geoshape', { query: 'dummy' }, { wikidataQueryService: true } );
		expect( await shape._runSqlQuery( [] ) ).toStrictEqual( [] );
	} );

	test( 'formats query', async () => {
		const dummyRows = [ 'rows' ];
		const returnedPromise = {
			then: jest.fn( ( cb ) => cb( dummyRows ) )
		};
		const mockDb = { query: jest.fn( () => returnedPromise ) };
		const sqlQuery = 'SELECT $1~ $2:csv $3';
		const ids = [ 'Q123', 'Q456' ];
		const shape = new GeoShapes(
			'geoshape',
			{ query: 'dummy' },
			{
				db: mockDb,
				polygonTable: 'polys',
				queries: { default: { sql: sqlQuery } },
				wikidataQueryService: true
			}
		);

		const geoRows = await shape._runSqlQuery( ids );

		expect( mockDb.query ).toHaveBeenCalledWith( sqlQuery, [ 'polys', ids ] );
		expect( geoRows ).toStrictEqual( dummyRows );
	} );
} );

describe( 'expandProperties', () => {
	test( 'handles empty list', () => {
		const shape = new GeoShapes( 'geoshape', { ids: 'Q123' }, {} );
		mockPreq.post = jest.fn();
		shape._expandProperties( {} );
		expect( mockPreq.post ).not.toHaveBeenCalled();
	} );

	test( 'maps and posts', async () => {
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
		mockPreq.post = jest.fn( () => Promise.resolve( preqResult ) );
		const apiUrl = 'https://api.test';
		const shape = new GeoShapes( 'geoshape', { ids: 'Q123' }, { mwapi: apiUrl } );

		const rawProperties = {
			Q123: {
				fill: {
					type: 'literal',
					value: '#f00'
				}
			}
		};
		const cleanProperties = await shape._expandProperties( rawProperties );

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
		expect( cleanProperties ).toStrictEqual( {
			Q123: basicProperties
		} );
	} );
} );

describe( 'wrapResult', () => {
	test( 'create geojson for GeoShape', () => {
		const shape = new GeoShapes( 'geoshape', { query: 'dummy' }, { wikidataQueryService: true } );

		const geoRows = [
			{
				id: 'dummy',
				data: JSON.stringify( {
					type: 'Point',
					coordinates: [ 0, 0 ]
				} )
			}
		];
		const result = shape._wrapResult( geoRows, {}, false );
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

	test( 'create geojson for GeoPoint', () => {
		const shape = new GeoShapes( 'geopoint', { query: 'dummy' }, { wikidataQueryService: true } );

		const properties = {
			Q188781: { geo: [ 34.83333333, 30.66666667 ], 'marker-color': '#800000' }
		};
		const result = shape._wrapResult( [], properties, true );
		const expectedResult = {
			features: [ {
				geometry: {
					coordinates: [ 34.83333333, 30.66666667 ],
					type: 'Point'
				},
				id: 'Q188781',
				properties: {
					'marker-color': '#800000'
				},
				type: 'Feature'
			}
			],
			type: 'FeatureCollection'
		};
		expect( result ).toStrictEqual( expectedResult );
	} );
} );

describe( 'execute', () => {
	test( 'wires functions together', async () => {

		const shape = new GeoShapes(
			'geoshape',
			{ query: 'dummy' },
			{ wikidataQueryService: true }
		);
		const rawProperties = {
			Q321: { fill: { type: 'literal', value: '#f00' } }
		};
		const cleanProperties = {
			Q321: [ {
				type: 'Feature',
				id: 'Q123',
				properties: {
					fill: '#f00'
				},
				geometry: { type: 'Point', coordinates: [ 0, 0 ] }
			} ]
		};
		const dummyRows = [ 'dummy' ];
		const ids = [ 'Q321' ];
		shape._runWikidataQuery = jest.fn( () => Promise.resolve( rawProperties ) );
		shape._runSqlQuery = jest.fn( () => Promise.resolve( dummyRows ) );
		shape._expandProperties = jest.fn( () => Promise.resolve( cleanProperties ) );
		shape._wrapResult = jest.fn( () => Promise.resolve() );

		const clientIp = '127.0.0.1';
		await shape.execute( clientIp );

		expect( shape._runWikidataQuery ).toHaveBeenCalledWith( clientIp );
		expect( shape._runSqlQuery ).toHaveBeenCalledWith( ids );
		expect( shape._expandProperties ).toHaveBeenCalledWith( rawProperties );
		expect( shape._wrapResult ).toHaveBeenCalledWith( dummyRows, cleanProperties, false );
	} );
} );
