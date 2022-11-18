'use strict';

/**
 * Test whether the autoPosition works for given GeoJSON
 */

const autoPosition = require( '../../../lib/snapshot/autoPosition' );
const geoJsonPolygon = require( '../fixtures/autoposition-geojson-polygon.json' );
const geoJsonPoint = require( '../fixtures/autoposition-geojson-point.json' );

describe( 'autoposition', () => {
	test( 'lat, lon and zoom set as auto', async () => {
		const coordinates = autoPosition( {
			lat: 'a',
			lon: 'a',
			zoom: 'a',
			w: 100,
			h: 100
		}, geoJsonPolygon );
		expect( coordinates ).toEqual( {
			latitude: -23.17508256414426,
			longitude: -45.85693359375,
			zoom: 8
		} );
	} );
	describe( 'when param is set for lat/lon/zoom it should return the param values', () => {
		test( 'zoom explicitly set', async () => {
			const coordinates = autoPosition( {
				lat: 'a',
				lon: 'a',
				zoom: 7,
				w: 100,
				h: 100
			}, geoJsonPolygon );
			expect( coordinates ).toEqual( {
				latitude: -23.17508256414426,
				longitude: -45.85693359375,
				zoom: 7
			} );
		} );

		test( 'lon explicitly set', async () => {
			const coordinates = autoPosition( {
				lat: 'a',
				lon: -45,
				zoom: 'a',
				w: 100,
				h: 100
			}, geoJsonPolygon );
			expect( coordinates ).toEqual( {
				latitude: -23.17508256414426,
				longitude: -45,
				zoom: 8
			} );
		} );

		test( 'lat explicitly set', async () => {
			const coordinates = autoPosition( {
				lat: -23,
				lon: 'a',
				zoom: 'a',
				w: 100,
				h: 100
			}, geoJsonPolygon );
			expect( coordinates ).toEqual( {
				latitude: -23,
				longitude: -45.85693359375,
				zoom: 8
			} );
		} );

		test( 'for points fallback to viewport() default minzoom if not set explicitly', async () => {
			const coordinates = autoPosition( {
				lat: 0,
				lon: 0,
				zoom: 'a',
				w: 100,
				h: 100
			}, geoJsonPoint );
			expect( coordinates ).toEqual( {
				latitude: 0,
				longitude: 0,
				zoom: 20
			} );
		} );

		test( 'for points use minzoom default if set explicitly', async () => {
			const coordinates = autoPosition( {
				lat: 0,
				lon: 0,
				zoom: 'a',
				w: 100,
				h: 100
			}, geoJsonPoint, 1, 19 );
			expect( coordinates ).toEqual( {
				latitude: 0,
				longitude: 0,
				zoom: 19
			} );
		} );
	} );
} );
