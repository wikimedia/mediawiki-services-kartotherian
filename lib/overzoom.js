/*
 OverZoomer is a storage wrapper. Given a tile source, it will retrieve requested tile from it,
 or if missing, will zoom out until it finds a tile, and extract needed portion of it.
 */
'use strict';

const Promise = require( 'bluebird' );
const Err = require( './err' );
const checkType = require( './input-validator' );
const uptile = require( 'tilelive-promise' );

let core;

function OverZoomer( uri, callback ) {
	let self = this;
	return Promise.try( () => {
		self = uptile( self );
		const params = checkType.normalizeUrl( uri ).query;
		if ( !params.source ) {
			throw new Err( "Uri must include 'source' query parameter: %j", uri );
		}
		self.minzoom = typeof params.minzoom === 'undefined' ? 0 : parseInt( params.minzoom, 10 );
		self.maxzoom = typeof params.maxzoom === 'undefined' ? 22 : parseInt( params.maxzoom, 10 );
		return core.loadSource( params.source );
	} ).then( ( source ) => {
		self.source = uptile( source );
		return self;
	} ).nodeify( callback );
}

OverZoomer.prototype.getAsync = Promise.method( function getAsync( opts ) {
	const self = this;

	if ( opts.type !== undefined && opts.type !== 'tile' ) {
		return self.source.getAsync( opts );
	}

	const opts2 = Object.assign( {}, opts );

	function getSubTile() {
		if ( opts2.z < self.minzoom || opts2.z > self.maxzoom ) {
			Err.throwNoTile();
		}
		return Promise.try( () => self.source.getAsync( opts2 ) )
			.catch( ( err ) => {
				if ( opts2.z > self.minzoom && Err.isNoTileError( err ) ) {
					// Tile is missing, zoom out and repeat
					opts2.z -= 1;
					opts2.x = Math.floor( opts2.x / 2 );
					opts2.y = Math.floor( opts2.y / 2 );
					return getSubTile();
				}

				throw err;
			} );
	}

	return getSubTile().then( ( res ) => {
		if ( opts2.z === opts.z || !res.data || res.data.length === 0 ) {
			// this is exactly what we were asked for initially
			return res;
		}

		if ( !res.headers ) {
			res.headers = {};
		}

		// Extract portion of the higher zoom tile as a new tile
		return core.uncompressAsync( res.data, res.headers )
			.then( ( pbf ) => {
				core.extractSubTileAsync( pbf, opts.z, opts.x, opts.y, opts2.z, opts2.x, opts2.y );
			} )
			.then( ( pbf ) => {
				res.data = pbf;
				res.headers.OverzoomFrom = opts2.z;
				return res;
			} ).then( ( res2 ) => core.compressPbfAsync( res2 ) );
	} );
} );

OverZoomer.initKartotherian = function initKartotherian( cor ) {
	core = cor;
	core.tilelive.protocols[ 'overzoom:' ] = OverZoomer;
};

module.exports = OverZoomer;
