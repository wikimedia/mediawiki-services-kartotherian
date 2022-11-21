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
			name: 'fails on null',
			input: [ null ],
			error: 'Bad GeoJSON - is null'
		},
		{
			name: 'fails on unknown input',
			input: [ 'foo' ],
			error: 'Bad GeoJSON - unknown javascript type "string"'
		},
		{
			name: 'fails on missing structure',
			input: [ {} ],
			error: 'Bad GeoJSON - object has no "type" property'
		},
		{
			name: 'fails on bad "type"',
			input: [ { type: 'Foo' } ],
			error: 'Bad GeoJSON - unknown "type" property "Foo"'
		}
	].forEach( ( { name, input, error } ) => {
		test( name, () => {
			expect( () => unrollGeoJSON( input ) ).toThrow( error );
		} );
	} );
} );
