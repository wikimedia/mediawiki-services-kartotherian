'use strict';

/**
 * Test whether the autoPosition works for given GeoJSON
 */

const autoPosition = require( '../../../lib/snapshot/autoPosition' );
const geoJsonPolygon = require( '../fixtures/autoposition-geojson-polygon.json' );
const geoJsonPoint = require( '../fixtures/autoposition-geojson-point.json' );
const geoJsonEmpty = {
	type: 'FeatureCollection',
	features: []
};

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
			zoom: 8,
			success: true
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
				zoom: 7,
				success: true
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
				zoom: 8,
				success: true
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
				zoom: 8,
				success: true
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
				zoom: 20,
				success: true
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
				zoom: 19,
				success: true
			} );
		} );

		test( 'for empty data partly fallback to defaults', async () => {
			const coordinates = autoPosition( {
				lat: 'a',
				lon: 2,
				zoom: 13,
				w: 100,
				h: 100
			}, geoJsonEmpty, 1, 19 );
			expect( coordinates ).toEqual( {
				latitude: 0,
				longitude: 2,
				zoom: 13,
				success: false
			} );
		} );

		test( 'for empty data fully fallback to defaults', async () => {
			const coordinates = autoPosition( {
				lat: 'a',
				lon: 'a',
				zoom: 'a',
				w: 100,
				h: 100
			}, geoJsonEmpty, 1, 19 );
			expect( coordinates ).toEqual( {
				latitude: 0,
				longitude: 0,
				zoom: 1,
				success: false
			} );
		} );
	} );
} );
