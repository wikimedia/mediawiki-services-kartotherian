'use strict';

const GeoShapes = require( '../lib/geoshapes/geoshapes' );

// Intercept external services
const mockPreq = require( 'preq' );

describe( 'parseParams', () => {
	test( 'errors on empty params', () => {
		expect( () => ( new GeoShapes() )._parseParams( {} ) )
			.toThrowError( 'must be given' );
	} );

	test( 'handles multiple and blank IDs', () => {
		const parsed = ( new GeoShapes() )._parseParams( { ids: 'Q123,,Q456' } );
		expect( parsed.ids ).toStrictEqual( [ 'Q123', 'Q456' ] );
	} );

	test( 'rejects non-Q-IDs', () => {
		expect( () => ( new GeoShapes() )._parseParams( { ids: 'A1' } ) )
			.toThrowError( 'Invalid' );
	} );

	test( 'happy minimal params', () => {
		const reqParams = {
			query: 'dummy'
		};
		const expectedParams = {
			sparqlQuery: 'dummy',
			ids: [],
			idColumn: undefined,
			useGeoJson: false,
			queryName: undefined
		};
		expect( ( new GeoShapes( { wikidataQueryService: true } ) )._parseParams( reqParams ) )
			.toStrictEqual( expectedParams );
	} );

	test( 'happy maximal params', () => {
		const reqParams = {
			query: 'dummy',
			ids: 'Q123',
			idcolumn: 'foo',
			getgeojson: '1',
			sql: 'test'
		};
		const expectedParams = {
			sparqlQuery: 'dummy',
			ids: [ 'Q123' ],
			idColumn: 'foo',
			useGeoJson: true,
			queryName: 'test'
		};
		expect( ( new GeoShapes( { wikidataQueryService: true } ) )._parseParams( reqParams ) )
			.toStrictEqual( expectedParams );
	} );
} );

describe( 'createPointsSparqlQuery', () => {
	test( 'creates an sparql query for geopoints', async () => {
		const shape = new GeoShapes( { coordinatePredicateId: 'wdt:P625' } );
		const expectedQuery = 'SELECT ?id ?geo WHERE { VALUES ?id { wd:Q123 wd:Q456 } ?id wdt:P625 ?geo }';
		expect( await shape._createPointsSparqlQuery( [ 'Q123', 'Q456' ] ) )
			.toStrictEqual( expectedQuery );
	} );
} );

describe( 'runWikidataQuery', () => {
	test( 'ignores geoshape IDs request', async () => {
		const shape = new GeoShapes();
		expect( await shape._runWikidataQuery( 'geoshape', undefined, [ 'Q123' ] ) ).toStrictEqual( [] );
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
		const shape = new GeoShapes( { sparqlHeaders: { 'X-Test': 'yes' }, wikidataQueryService: uri } );
		const returnedPromise = {
			then: jest.fn( ( result ) => {
				result( preqResult );
			} )
		};
		mockPreq.get = jest.fn( () => returnedPromise );

		const result = await shape._runWikidataQuery( 'geoshape', sparqlQuery, [], undefined, '127.0.0.1' );
		expect( result ).toStrictEqual( [
			{ id: 'Q321', fill: { type: 'literal', value: '#f00' } }
		] );

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

	test( 'handle multiple points for an entity', async () => {
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
							geo: {
								type: 'literal',
								datatype: 'http://www.opengis.net/ont/geosparql#wktLiteral',
								value: 'Point(12.34 56.78)'
							}
						},
						{
							id: {
								type: 'uri',
								value: 'http://www.wikidata.org/entity/Q321'
							},
							geo: {
								type: 'literal',
								datatype: 'http://www.opengis.net/ont/geosparql#wktLiteral',
								value: 'Point(43.21 98.76)'
							}
						}
					]
				}
			}
		};
		const shape = new GeoShapes( { sparqlHeaders: {}, wikidataQueryService: true } );
		const returnedPromise = {
			then: jest.fn( ( result ) => {
				result( preqResult );
			} )
		};
		mockPreq.get = jest.fn( () => returnedPromise );

		const result = await shape._runWikidataQuery( 'geopoint', undefined, [ 'Q321' ] );
		expect( result ).toStrictEqual( [
			{
				id: 'Q321',
				geo: {
					datatype: 'http://www.opengis.net/ont/geosparql#wktLiteral',
					type: 'literal',
					value: 'Point(12.34 56.78)'
				}
			},
			{
				id: 'Q321',
				geo: {
					datatype: 'http://www.opengis.net/ont/geosparql#wktLiteral',
					type: 'literal',
					value: 'Point(43.21 98.76)'
				}
			}
		] );
	} );
} );

describe( 'runSqlQuery', () => {
	test( 'ignores sparql query', async () => {
		const shape = new GeoShapes( { wikidataQueryService: true } );
		expect( await shape._runSqlQuery( 'geoshape', [] ) ).toStrictEqual( [] );
	} );

	test( 'formats query', async () => {
		const dummyRows = [ 'rows' ];
		const returnedPromise = {
			catch: jest.fn( () => dummyRows )
		};
		const mockDb = { query: jest.fn( () => returnedPromise ) };
		const sqlQuery = 'SELECT $1~ $2:csv $3';
		const ids = [ 'Q123', 'Q456' ];
		const shape = new GeoShapes(
			{
				db: mockDb,
				polygonTable: 'polys',
				queries: { default: { sql: sqlQuery } },
				wikidataQueryService: true
			}
		);

		const geoRows = await shape._runSqlQuery( 'geoshape', ids );

		expect( mockDb.query ).toHaveBeenCalledWith( sqlQuery, [ 'polys', ids ] );
		expect( geoRows ).toStrictEqual( dummyRows );
	} );
} );

describe( 'expandProperties', () => {
	test( 'handles empty list', () => {
		const shape = new GeoShapes();
		mockPreq.post = jest.fn();
		shape._expandProperties( [] );
		expect( mockPreq.post ).not.toHaveBeenCalled();
	} );

	test( 'maps and posts', async () => {
		const rawProperties = [
			{
				id: 'Q123',
				fill: {
					type: 'literal',
					value: '#f00'
				},
				'marker-symbol': {
					type: 'literal',
					value: '-letter'
				}
			}
		];
		const rawGeoJsonWithFakeGeometry = [ {
			type: 'Feature',
			id: 'Q123',
			properties: {
				fill: '#f00',
				'marker-symbol': '-letter'
			},
			geometry: { type: 'Point', coordinates: [ 0, 0 ] }
		} ];
		const sanitizedProperties = {
			type: 'Feature',
			id: 'Q123',
			properties: {
				fill: '#f00',
				'marker-symbol': 'a'
			},
			geometry: { type: 'Point', coordinates: [ 0, 0 ] }
		};
		const expectedProperties = [ sanitizedProperties ];
		const preqResult = {
			headers: {
				'content-type': 'application/sparql-results+json'
			},
			body: {
				'sanitize-mapdata': {
					sanitized: JSON.stringify( [ {
						id: 'Q123',
						properties: sanitizedProperties
					} ] )
				}
			}
		};
		mockPreq.post = jest.fn( () => Promise.resolve( preqResult ) );
		const apiUrl = 'https://api.test';
		const shape = new GeoShapes( { mwapi: apiUrl } );

		const cleanProperties = await shape._expandProperties( rawProperties );

		expect( mockPreq.post ).toHaveBeenCalledWith( {
			formData: {
				action: 'sanitize-mapdata',
				format: 'json',
				formatversion: 2,
				text: JSON.stringify( rawGeoJsonWithFakeGeometry )
			},
			headers: undefined,
			uri: apiUrl
		} );
		expect( cleanProperties ).toStrictEqual( expectedProperties );
	} );
} );

describe( 'wrapResult', () => {
	test( 'create topojson for GeoShape', () => {
		const shape = new GeoShapes( { wikidataQueryService: true } );

		const geoRows = [
			{
				id: 'dummy',
				data: JSON.stringify( {
					type: 'Point',
					coordinates: [ 0, 0 ]
				} )
			}
		];
		const result = shape._wrapResult( 'geoshape', geoRows, [], false );
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

	test( 'create GeoJSON for GeoShape', () => {
		const shape = new GeoShapes( { wikidataQueryService: true } );

		const geoRows = [
			{
				id: 'dummy',
				data: JSON.stringify( {
					type: 'Point',
					coordinates: [ 1, 2 ]
				} )
			}
		];
		const result = shape._wrapResult( 'geoshape', geoRows, [], true );
		const expectedResult = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [ 1, 2 ]
					},
					id: 'dummy',
					properties: {}
				}
			]
		};
		expect( result ).toStrictEqual( expectedResult );
	} );

	test( 'create GeoJSON for GeoPoint', () => {
		const shape = new GeoShapes( { wikidataQueryService: true } );

		const properties = [
			{ id: 'Q188781', geo: [ 34.83333333, 30.66666667 ], 'marker-color': '#800000' }
		];
		const result = shape._wrapResult( 'geopoint', [], properties, true );
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

	test( 'shape property merged from mapframe', () => {
		const shape = new GeoShapes( 'geoshape', { query: 'dummy' }, { wikidataQueryService: true } );

		const geoRows = [
			{
				id: 'Q123',
				data: JSON.stringify( {
					type: 'Point',
					coordinates: [ 1, 2 ]
				} )
			}
		];
		const properties = [
			{ id: 'Q123', fill: '#00f' }
		];
		const result = shape._wrapResult( 'geoshape', geoRows, properties, true );
		const expectedResult = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [ 1, 2 ]
					},
					id: 'Q123',
					properties: {
						fill: '#00f'
					}
				}
			]
		};
		expect( result ).toStrictEqual( expectedResult );
	} );

	test( 'filter results with no coordinates', () => {
		const shape = new GeoShapes( { wikidataQueryService: true } );

		const properties = [
			{ id: 'Q188781' }
		];
		const result = shape._wrapResult( 'geopoint', [], properties, true );
		const expectedResult = {
			features: [],
			type: 'FeatureCollection'
		};
		expect( result ).toStrictEqual( expectedResult );
	} );
} );

describe( 'execute', () => {
	test( 'wires functions together', async () => {

		const sparqlQuery = 'dummyQuery';
		const reqParams = { query: sparqlQuery };
		const shape = new GeoShapes( { wikidataQueryService: true } );
		const rawProperties = [
			{ id: 'Q321', fill: { type: 'literal', value: '#f00' } }
		];
		const cleanProperties = [
			{ id: 'Q321', fill: '#f00' }
		];
		const type = 'geoshape';
		const dummyRows = [ 'dummy' ];
		const ids = [ 'Q321' ];
		shape._runWikidataQuery = jest.fn( () => Promise.resolve( rawProperties ) );
		shape._runSqlQuery = jest.fn( () => Promise.resolve( dummyRows ) );
		shape._expandProperties = jest.fn( () => Promise.resolve( cleanProperties ) );
		shape._wrapResult = jest.fn( () => Promise.resolve() );

		const clientIp = '127.0.0.1';
		const metrics = { makeMetric: jest.fn( () => ( { endTiming: jest.fn() } ) ) };
		await shape.execute( type, reqParams, clientIp, metrics );

		expect( shape._runWikidataQuery ).toHaveBeenCalledWith(
			type, sparqlQuery, [], undefined, clientIp );
		expect( shape._runSqlQuery ).toHaveBeenCalledWith( type, ids, undefined, reqParams );
		expect( shape._expandProperties ).toHaveBeenCalledWith( rawProperties );
		expect( shape._wrapResult ).toHaveBeenCalledWith( type, dummyRows, cleanProperties, false );
		expect( metrics.makeMetric ).toHaveBeenCalled();
	} );
} );
