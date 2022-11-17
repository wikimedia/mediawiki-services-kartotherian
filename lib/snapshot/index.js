'use strict';

const util = require( 'util' );
const Err = require( '../err' );
const Promise = require( 'bluebird' );
const abaculus = Promise.promisify( require( '@kartotherian/abaculus' ), { multiArgs: true } );
const Overlay = require( '@wikimedia/tilelive-overlay' );
const _ = require( 'underscore' );
const checkType = require( '../input-validator' );
const makeDomainValidator = require( 'domain-validator' );
const autoPosition = require( './autoPosition' );
const packageInfo = require( '../../package.json' );

let core;
let mapdataLoader;
let getProtocolForHostname;
let mapnik;

/**
 * @param {Object} params
 * @param {Object} source
 */
function normalizeLatLonZoom( params, source ) {
	params.lat = checkType.strToFloat( params.lat );
	params.lon = checkType.strToFloat( params.lon );
	params.zoom = core.validateZoom( params.zoom, source );

	if ( typeof params.lat !== 'number' || typeof params.lon !== 'number' ) {
		throw new Err( 'The lat and lon coordinates must be numeric for static images' )
			.metrics( 'err.req.stcoords' );
	}
}

/**
 * @param {Object} queryParams
 * @param {Object} params
 * @param {Object} source
 */
function normalizeBaseParameters( queryParams, params, source ) {
	if ( queryParams.lang ) {
		params.lang = queryParams.lang;
	}

	params.scale = core.validateScale( params.scale, source );

	// Overlays only support 2x scaling
	// so if scale is less than <1.5x, drop to 1x, otherwise - 2x
	params.scale = ( !params.scale || params.scale < 1.5 ) ? 1 : 2;

	if ( !source.static ) {
		throw new Err( 'Static snapshot images are not enabled for this source' ).metrics( 'err.req.static' );
	}
	if ( ( params.format !== 'png' && params.format !== 'jpeg' ) || !_.contains( source.formats, params.format ) ) {
		throw new Err( 'Format %s is not allowed for static images', params.format ).metrics( 'err.req.stformat' );
	}
	params.w = checkType.strToInt( params.w );
	params.h = checkType.strToInt( params.h );

	if ( !Number.isInteger( params.w ) || !Number.isInteger( params.h ) ) {
		throw new Err( 'The width and height params must be integers for static images' ).metrics( 'err.req.stsize' );
	}
	if ( params.w > source.maxwidth || params.h > source.maxheight ) {
		throw new Err( 'Requested image is too big' ).metrics( 'err.req.stsizebig' );
	}
}

/**
 * @param {Object} queryParams
 * @param {string|null} format
 */
function validateMapOverlayParameters( queryParams, format ) {
	if ( format !== 'png' ) {
		throw new Err( 'Only png format is allowed for images with overlays' ).metrics( 'err.req.stnonpng' );
	}
	if ( !queryParams.domain || !queryParams.title ) {
		throw new Err( 'Both domain and title params are required' ).metrics( 'err.req.stboth' );
	}
	if ( queryParams.groups ) {
		queryParams.groups = queryParams.groups.split( ',' );
	} else {
		throw new Err( 'A comma-separated list of groups is required' ).metrics( 'err.req.stgroups' );
	}
	if ( queryParams.title.indexOf( '|' ) !== -1 ) {
		throw new Err( 'title param may not contain pipe "|" symbol' ).metrics( 'err.req.stpipe' );
	}
	if ( queryParams.revid && queryParams.revid.indexOf( '|' ) !== -1 ) {
		throw new Err( 'revid param may not contain pipe "|" symbol' ).metrics( 'err.req.stpipe' );
	}
}

/**
 * @param {Object} params
 * @param {Object} tileSource
 * @return {{zoom: number, scale: number, center: {y: number, x: number, w:
 *  number, h: number}, format: string, getTile: Function}}
 */
function makeAbaculusParameters( params, tileSource ) {
	return {
		zoom: params.zoom,
		scale: params.scale,
		center: {
			y: Math.min( 85, Math.max( -85, params.lat ) ),
			x: Math.min( 180, Math.max( -180, params.lon ) ),
			w: params.w,
			h: params.h
		},
		format: params.format,
		getTile( z, x, y, cb ) {
			if ( typeof tileSource.getAsync === 'function' ) {
				const opts = {
					type: 'tile',
					z,
					x,
					y,
					scale: params.scale,
					lang: params.lang
				};
				return tileSource.getAsync( opts )
					.then( ( data ) => cb( undefined, data.data, data.headers ) )
					.catch( ( err ) => cb( err ) );
			}
			// source is old school and can't receive lang param
			return tileSource.getTile( z, x, y, cb );
		}
	};
}

/**
 * Web server (express) route handler to get a snapshot image
 *
 * @param {express.Request} req web request object
 * @param {express.Response} res web response object
 * @param {express.NextFunction} next will be called if request is not handled
 * @return {Promise}
 */
function requestHandler( req, res, next ) {
	let source;
	let protocol;
	const params = req && req.params;
	const qparams = req && req.query;
	const start = Date.now();

	return Promise.try( () => {
		source = core.getPublicSource( params.src );

		normalizeBaseParameters( qparams, params, source );

		const noOverlay = !qparams.domain && !qparams.title;
		const useAutoCentering = params.lat === 'a' || params.lon === 'a';
		const useAutoZooming = params.zoom === 'a';
		const useAutoPositioning = useAutoCentering || useAutoZooming;

		// `lat` and `lon` should be set to `a`
		if ( useAutoCentering && params.lat !== params.lon ) {
			throw new Err( 'Both latitude and longitude must be numbers, or they must both be set to the letter "a" for auto positioning' ).metrics( 'err.req.stauto' );
		}

		if ( noOverlay ) {
			if ( useAutoPositioning ) {
				throw new Err( 'Auto zoom or positioning is only allowed when both domain and title are present' ).metrics( 'err.req.stauto' );
			}

			normalizeLatLonZoom( params, source );

			// Return image without overlay
			return abaculus( makeAbaculusParameters( params, source.getHandler() ) );
		}

		if ( !mapdataLoader ) {
			throw new Err( 'Snapshot overlays are disabled, conf.allowedDomains is not set' ).metrics( 'err.req.stdisabled' );
		}

		validateMapOverlayParameters( qparams, params.format );

		// TODO: assume URL and simplify here once Kartographer is upgraded
		const withoutProtocol = qparams.domain.replace( /(https?:)?\/\//, '' );
		const hostname = withoutProtocol.replace( /:\d+$/, '' );
		protocol = getProtocolForHostname( hostname );

		let baseMapHdrs = {};
		const isVersioned = core.getConfiguration().versioned_maps !== false;

		const contact = core.getConfiguration().userAgentContact || '';
		const userAgent = `${packageInfo.name}/${packageInfo.version} ${contact}`.trim();

		return mapdataLoader(
			req, protocol, withoutProtocol, qparams.title,
			isVersioned && qparams.revid, qparams.groups,
			userAgent
		).then( ( geoJSON ) => {
			let mapPosition;

			if ( useAutoPositioning ) {
				mapPosition = autoPosition( params, geoJSON, source.minzoom, source.maxzoom );
				params.lon = mapPosition.longitude;
				params.lat = mapPosition.latitude;
				params.zoom = mapPosition.zoom;
				if ( ![ params.lon, params.lat, params.zoom ].every( Number.isFinite ) ) {
					req.logger.log( 'warn', 'Failed autopositioning' );
				}
			}

			normalizeLatLonZoom( params, source );
			const renderBaseMap = abaculus( makeAbaculusParameters( params, source.getHandler() ) )
				.spread( ( data, headers ) => {
					baseMapHdrs = headers;
					return mapnik.Image.fromBytesAsync( data );
				} ).then( ( image ) => image.premultiplyAsync() );

			// This is far from ideal - we should be using geojson-mapnikify directly
			const renderOverlayMap = Promise.try( () => new Promise( ( accept, reject ) => {
				// Render overlay layer
				const url = `overlaydata://${params.scale === 2 ? '2x:' : ''}${JSON.stringify( geoJSON )}`;
				// FIXME: using `new` for side-effects
				// eslint-disable-next-line no-new
				new Overlay( url, ( err, overlay ) => {
					if ( err ) { reject( err ); }
					accept( overlay );
				} );
			} ) ).then( ( overlay ) => abaculus( makeAbaculusParameters( params, overlay ) ) )
				.then( ( overlayBuf ) => mapnik.Image.fromBytesAsync( overlayBuf[ 0 ] ) )
				.then( ( image ) => image.premultiplyAsync() );

			return Promise.join(
				renderBaseMap,
				renderOverlayMap,
				( baseImage, overlayImage ) =>

					baseImage.compositeAsync( overlayImage )
				// }).then(image => {
				//     // Not sure if this step is needed - result appears identical
				//     return image.demultiplyAsync();

			);
		} )
			.then( ( image ) => image.encodeAsync( 'png8:m=h:z=9' ) ).then( ( image ) => [ image, baseMapHdrs ] );
	} ).spread( ( data, dataHeaders ) => {
		core.setResponseHeaders( res, source, dataHeaders );

		res.send( data );

		// replace '.' with ',' -- otherwise grafana treats it as a divider
		const scale = params.scale.toString().replace( '.', ',' );
		const mx = util.format( 'req.%s.%s.%s.static.%s', params.src, params.zoom, params.format, scale );
		core.metrics.makeMetric( {
			type: 'Histogram',
			name: mx,
			prometheus: {
				buckets: [ 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000 ],
				name: 'kartotherian_' + mx.replace( '.', '_' ) + '_milliseconds',
				help: 'Time taken to serve a snapshot request'
			}
		} ).endTiming( start );
	} ).catch( ( err ) => core.reportRequestError( err, res ) ).catch( next );
}

module.exports = function snapshot( cor, router ) {
	( { mapnik, ...core } = cor );

	const { allowedDomains } = core.getConfiguration();
	const httpsDomains = makeDomainValidator(
		allowedDomains ? allowedDomains.https : undefined, true
	);
	const httpDomains = makeDomainValidator(
		allowedDomains ? allowedDomains.http : undefined, true
	);

	getProtocolForHostname = ( domain ) => {
		if ( httpsDomains.test( domain ) ) {
			return 'https';
		} else if ( httpDomains.test( domain ) ) {
			return 'http';
		}
		throw new Err( 'Domain is not allowed' ).metrics( 'err.req.domain' );
	};

	if ( allowedDomains ) {
		( { downloadMapdata: mapdataLoader } = require( './mapdataLoader' ) );
	}

	// get static image
	router.get( `/img/:src(${core.Sources.sourceIdReStr}),:zoom(a|\\d+),:lat(a|[-\\d\\.]+),:lon(a|[-\\d\\.]+),:w(\\d+)x:h(\\d+)(@:scale([\\.\\d]+)x)?.:format([\\w]+)`, requestHandler );
};
