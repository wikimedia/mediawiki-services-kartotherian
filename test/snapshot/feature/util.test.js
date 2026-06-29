'use strict';

const { unrollGeoJSON } = require( '../../../lib/snapshot/util' );

describe( 'snapshot utils', () => {
	[
		{
			name: 'unrolls empty list',
			input: [],
			output: []
		},
		{
			name: 'unrolls single feature',
			input: [ { type: 'Feature' } ],
			output: [ { properties: {}, type: 'Feature' } ]
		},
		{
			name: 'unrolls FeatureCollection',
			input: [
				{
					type: 'FeatureCollection',
					features: [
						{ type: 'Feature' },
						{ type: 'Feature' }
					]
				}
			],
			output: [
				{ properties: {}, type: 'Feature' },
				{ properties: {}, type: 'Feature' }
			]
		},
		{
			name: 'unrolls recursively',
			input: [
				{
					type: 'FeatureCollection',
					features: [
						{
							type: 'FeatureCollection',
							features: [ { type: 'Feature' } ]
						}
					]
				}
			],
			output: [ { properties: {}, type: 'Feature' } ]
		}
	].forEach( ( { name, input, output } ) => {
		test( name, () => {
			const result = unrollGeoJSON( input );
			expect( result ).toStrictEqual( output );
		} );
	} );

	[
		{
			name: 'skips null with warning',
			input: [ null ],
			warning: 'Bad GeoJSON - is null'
		},
		{
			name: 'skips unknown input with warning',
			input: [ 'foo' ],
			warning: 'Bad GeoJSON - unknown javascript type "string"'
		},
		{
			name: 'skips missing structure with warning',
			input: [ {} ],
			warning: 'Bad GeoJSON - object has no "type" property'
		},
		{
			name: 'skips bad "type" with warning',
			input: [ { type: 'Foo' } ],
			warning: 'Bad GeoJSON - unknown "type" property "Foo"'
		},
		{
			name: 'skips ExternalData with warning',
			input: [ { type: 'ExternalData', service: 'geoshape', ids: 'Q6298716' } ],
			warning: 'Bad GeoJSON - unknown "type" property "ExternalData"'
		}
	].forEach( ( { name, input, warning } ) => {
		test( name, () => {
			const logged = [];
			const result = unrollGeoJSON( input, ( level, msg ) => logged.push( { level, msg } ) );
			expect( result ).toStrictEqual( [] );
			expect( logged ).toStrictEqual( [ { level: 'warn', msg: warning } ] );
		} );
	} );
} );
