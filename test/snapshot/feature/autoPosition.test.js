/**
 * Test whether the autoPosition works for given GeoJSON
 */

const autoPosition = require( '../../../lib/snapshot/autoPosition' );
const geoJson = require( '../fixtures/autoposition-geojson.json' );

describe( 'autoposition', () => {
	test( 'lat, lon and zoom set as auto', async () => {
		const coordinates = autoPosition( {
			lat: 'a',
			lon: 'a',
			zoom: 'a',
			w: 100,
			h: 100,
		}, geoJson );
		expect( coordinates ).toEqual( {
			latitude: -23.17508256414426,
			longitude: -45.85693359375,
			zoom: 8,
		} );
	} );
	describe( 'when param is set for lat/lon/zoom it should return the param values', () => {
		test( 'zoom explicitly set', async () => {
			const coordinates = autoPosition( {
				lat: 'a',
				lon: 'a',
				zoom: 7,
				w: 100,
				h: 100,
			}, geoJson );
			expect( coordinates ).toEqual( {
				latitude: -23.17508256414426,
				longitude: -45.85693359375,
				zoom: 7,
			} );
		} );

		test( 'lon explicitly set', async () => {
			const coordinates = autoPosition( {
				lat: 'a',
				lon: -45,
				zoom: 'a',
				w: 100,
				h: 100,
			}, geoJson );
			expect( coordinates ).toEqual( {
				latitude: -23.17508256414426,
				longitude: -45,
				zoom: 8,
			} );
		} );

		test( 'lat explicitly set', async () => {
			const coordinates = autoPosition( {
				lat: -23,
				lon: 'a',
				zoom: 'a',
				w: 100,
				h: 100,
			}, geoJson );
			expect( coordinates ).toEqual( {
				latitude: -23,
				longitude: -45.85693359375,
				zoom: 8,
			} );
		} );
	} );
} );
