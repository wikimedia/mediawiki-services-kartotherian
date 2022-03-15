/*
Substantial is a tile generator wrapper. Given a tile source, it will retrieve
requested tile from it, and check if the tile has enough useful information in
it to save it, rather than skip it and let kartotherian use overzooming later.
 */

const Promise = require( 'bluebird' );
const qidx = require( 'quadtile-index' );
const Err = require( './err' );
const checkType = require( './input-validator' );
const _ = require( 'underscore' );

let core;

function query( options ) {
	const self = this;
	const applyFilter = options.zoom >= self.params.minzoom && options.zoom <= self.params.maxzoom;
	const iterator = this.source.query(
		applyFilter ? _.extend( options, { getTiles: true } ) : options
	);
	let isDone = false;

	if ( !applyFilter ) {
		return iterator;
	}
	const getNextValAsync = () => {
		if ( isDone ) {
			return Promise.resolve( undefined );
		}
		return iterator().then( ( iterValue ) => {
			if ( iterValue !== undefined ) {
				const xy = qidx.indexToXY( iterValue.idx );
				return self._testTile( iterValue.zoom, xy[ 0 ], xy[ 1 ], iterValue.tile )
					.return( iterValue );
			}
			isDone = true;
			// FIXME: dubious lint foolishness:
			return undefined;
		} ).catch( ( err ) => {
			if ( Err.isNoTileError( err ) ) {
				return getNextValAsync();
			}
			throw err;
		} );
	};
	return getNextValAsync;
}

function Substantial( uri, callback ) {
	const self = this;
	return Promise.try( () => {
		const params = checkType.normalizeUrl( uri ).query;
		if ( !params.source ) {
			throw new Err( "Uri must include 'source' query parameter: %j", uri );
		}
		checkType( params, 'minzoom', 'integer', 0, 0, 22 );
		checkType( params, 'maxzoom', 'integer', 22, params.minzoom + 1, 22 );
		checkType( params, 'maxsize', 'integer', undefined, 0 );
		checkType( params, 'layers', 'string-array', true, 1 );
		checkType( params, 'debug', 'boolean', false );
		self.params = params;
		return core.loadSource( params.source );
	} ).then( ( handler ) => {
		self.source = handler;
		if ( handler.query ) {
			self.query = query;
		}
		if ( self.params.debug ) {
			// in debug mode, return a predefined tile instead
			return self.source.getTileAsync( 9, 156, 190 ).then( ( dh ) => {
				self.params.debug = dh;
			} );
		}
		// FIXME: linter insists on this:
		return undefined;
	} ).return( self ).nodeify( callback );
}

Substantial.prototype.getTile = function getTile( z, x, y, callback ) {
	const self = this;
	return self.source.getTileAsync( z, x, y ).then( ( dh ) => {
		if ( z < self.params.minzoom || z > self.params.maxzoom ) {
			return dh;
		}
		let p = self._testTile( z, x, y, dh[ 0 ] ).return( dh );
		if ( self.params.debug ) {
			// For debug mode, return predefined tile when no tile error would be thrown otherwise
			p = p.catch( ( err ) => {
				if ( Err.isNoTileError( err ) ) {
					return self.params.debug;
				}
				throw err;
			} );
		}
		return p;
	} ).nodeify( callback, { spread: true } );
};

Substantial.prototype.getInfo = function getInfo( callback ) {
	return this.source.getInfo( callback );
};

/**
 * Checks if data satisfies filtering requirements, and succeeds if it should be passed,
 * or errors out with the missing tile error
 * @return {Promise}
 * @private
 */
Substantial.prototype._testTile = function _testTile( zoom, x, y, data ) {
	// this must be set to the source
	const self = this;
	if ( !data ) {
		Err.throwNoTile();
	}
	if ( data.length >= self.params.maxsize ) {
		return Promise.resolve( undefined ); // generated tile is too big, save
	}
	const vt = new core.mapnik.VectorTile( zoom, x, y );
	return core.uncompressAsync( data )
		.then( ( uncompressed ) => vt.setDataAsync( uncompressed ) )
		.then( () => {
			if ( vt.empty() ) {
				Err.throwNoTile();
			} else {
				const layers = vt.names();
				if ( layers.length === 0 ||
                ( layers.length === 1 && _.contains( self.params.layers, layers[ 0 ] ) )
				) {
				// TODO: BUG?: should we use query() to check if there are any features?
				// either no layers, or only contains one whitelisted layer
					Err.throwNoTile();
				}
			}
		} );
};

Substantial.initKartotherian = ( cor ) => {
	core = cor;
	core.tilelive.protocols[ 'substantial:' ] = Substantial;
};

module.exports = Substantial;
