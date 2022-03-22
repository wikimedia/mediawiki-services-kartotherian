const util = require( 'util' );
const Err = require( '../err' );
const Promise = require( 'bluebird' );
const abaculus = Promise.promisify( require( '@kartotherian/abaculus' ), { multiArgs: true } );
const Overlay = require( '@kartotherian/tilelive-overlay' );
const _ = require( 'underscore' );
const checkType = require( '../input-validator' );
const makeDomainValidator = require( 'domain-validator' );
const autoPosition = require( './autoPosition' );

let core;
let mapdataLoader;
let getProtocolForHostname;
let mapnik;

/**
 * Magical float regex found in http://stackoverflow.com/a/21664614/177275
 * @type {RegExp}
 */
const floatRe = /^-?\d+(?:[.,]\d*?)?$/;

/**
 * Converts value to float if possible, or returns the original
 */
function strToFloat( value ) {
	if ( typeof value === 'string' && floatRe.test( value ) ) {
		return parseFloat( value );
	}
	return value;
}

/**
 * Create a parameters object for Abaculus
 * @param params
 * @param tileSource
 * @return {{zoom: number, scale: number, center: {y: number, x: number, w:
 *  number, h: number}, format: string, getTile: Function}}
 */
function makeParams( params, tileSource ) {
	return {
		zoom: params.zoom,
		scale: params.scale,
		center: {
			y: Math.min( 85, Math.max( -85, params.lat ) ),
			x: Math.min( 180, Math.max( -180, params.lon ) ),
			w: params.w,
			h: params.h,
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
					lang: params.lang,
				};
				return tileSource.getAsync( opts )
					.then( ( data ) => cb( undefined, data.data, data.headers ) )
					.catch( ( err ) => cb( err ) );
			}
			// source is old school and can't receive lang param
			return tileSource.getTile( z, x, y, cb );
		},
	};
}

/**
 * Web server (express) route handler to get a snapshot image
 * @param {express.Request} req web request object
 * @param {express.Response} res web response object
 * @param {express.NextFunction} next will be called if request is not handled
 */
function requestHandler( req, res, next ) {
	let source;
	let protocol;
	const params = req && req.params;
	const qparams = req && req.query;
	const start = Date.now();

	return Promise.try( () => {
		source = core.getPublicSource( params.src );

		if ( qparams.lang ) {
			params.lang = qparams.lang;
		}

		if ( params.scale !== undefined ) {
			// From "@2x", remove first and last characters
			params.scale = params.scale.substring( 1, params.scale.length - 1 );
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

			// For now returns JPEG without overlays
			params.lat = strToFloat( params.lat );
			params.lon = strToFloat( params.lon );
			params.zoom = core.validateZoom( params.zoom, source );
			if ( typeof params.lat !== 'number' || typeof params.lon !== 'number' ) {
				throw new Err( 'The lat and lon coordinates must be numeric for static images' ).metrics( 'err.req.stcoords' );
			}
			return abaculus( makeParams( params, source.getHandler() ) );
		}

		if ( !mapdataLoader ) {
			throw new Err( 'Snapshot overlays are disabled, conf.allowedDomains is not set' ).metrics( 'err.req.stdisabled' );
		}
		if ( !qparams.domain || !qparams.title ) {
			throw new Err( 'Both domain and title params are required' ).metrics( 'err.req.stboth' );
		}
		if ( qparams.groups ) {
			qparams.groups = qparams.groups.split( ',' );
		} else {
			throw new Err( 'A comma-separated list of groups is required' ).metrics( 'err.req.stgroups' );
		}
		if ( params.format !== 'png' ) {
			throw new Err( 'Only png format is allowed for images with overlays' ).metrics( 'err.req.stnonpng' );
		}
		if ( qparams.title.indexOf( '|' ) !== -1 ) {
			throw new Err( 'title param may not contain pipe "|" symbol' ).metrics( 'err.req.stpipe' );
		}
		if ( qparams.revid && qparams.revid.indexOf( '|' ) !== -1 ) {
			throw new Err( 'revid param may not contain pipe "|" symbol' ).metrics( 'err.req.stpipe' );
		}
		// TODO: assume URL and simplify here once Kartographer is upgraded
		const withoutProtocol = qparams.domain.replace( /https?:\/\//, '' );
		const hostname = withoutProtocol.replace( /:\d+$/, '' );
		protocol = getProtocolForHostname( hostname );

		let baseMapHdrs = {};
		const isVersioned = core.getConfiguration().versioned_maps !== false;

		return mapdataLoader(
			req, protocol, withoutProtocol, qparams.title,
			isVersioned && qparams.revid, qparams.groups
		).then( ( geojson ) => {
			let mapPosition;

			if ( useAutoPositioning ) {
				mapPosition = autoPosition( params, geojson );
				params.lon = mapPosition.longitude;
				params.lat = mapPosition.latitude;
				params.zoom = mapPosition.zoom;
			} else {
				params.lat = strToFloat( params.lat );
				params.lon = strToFloat( params.lon );
			}
			params.zoom = core.validateZoom( params.zoom, source );

			const renderBaseMap = abaculus( makeParams( params, source.getHandler() ) )
				.spread( ( data, headers ) => {
					baseMapHdrs = headers;
					return mapnik.Image.fromBytesAsync( data );
				} ).then( ( image ) => image.premultiplyAsync() );

			// This is far from ideal - we should be using geojson-mapnikify directly
			const renderOverlayMap = Promise.try( () => new Promise( ( accept, reject ) => {
				// Render overlay layer
				const url = `overlaydata://${params.scale === 2 ? '2x:' : ''}${JSON.stringify( geojson )}`;
				// FIXME: using `new` for side-effects
				// eslint-disable-next-line no-new
				new Overlay( url, ( err, overlay ) => {
					if ( err ) { reject( err ); }
					accept( overlay );
				} );
			} ) ).then( ( overlay ) => abaculus( makeParams( params, overlay ) ) )
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

		let mx = util.format( 'req.%s.%s.%s.static', params.src, params.zoom, params.format );
		if ( params.scale ) {
			// replace '.' with ',' -- otherwise grafana treats it as a divider
			const scale = params.scale.toString().replace( '.', ',' );
			mx += `.${scale}`;
		}
		core.metrics.endTiming( mx, start );
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
		mapdataLoader = require( './mapdataLoader' );
	}

	// get static image
	router.get( `/img/:src(${core.Sources.sourceIdReStr}),:zoom(a|\\d+),:lat(a|[-\\d\\.]+),:lon(a|[-\\d\\.]+),:w(\\d+)x:h(\\d+):scale(@[\\.\\d]+x)?.:format([\\w]+)?`, requestHandler );
};
