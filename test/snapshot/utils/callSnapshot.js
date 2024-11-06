'use strict';

const snapshotSetup = require( '../../../lib/snapshot' );

module.exports = ( additionalConfig, queryParams ) => new Promise( ( resolve ) => {
	const core = {
		getConfiguration: () => ( {
			allowedDomains: {
				http: [ 'localhost' ]
			},
			...additionalConfig
		} ),
		getPublicSource() {
			return {
				formats: [ 'png' ],
				getHandler: jest.fn(),
				maxwidth: 9999,
				maxheight: 9999,
				static: true
			};
		},
		reportRequestError: ( err ) => {
			throw err;
		},
		validateScale: () => true,
		Sources: []
	};
	const router = {
		get: ( route, handler ) => {
			// Immediately call the handler rather than installing on a route.
			const req = {
				params: {
					format: 'png',
					h: 100,
					w: 100
				},
				query: {
					...queryParams
				}
			};
				// TODO: catch and log errors from res
			const res = jest.fn();
			const next = jest.fn();
			handler( req, res, next ).then( () => {
				resolve( [ req, res, next ] );
			} );
		}
	};
	snapshotSetup( core, router );
} );
