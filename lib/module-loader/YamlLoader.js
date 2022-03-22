'use strict';

const pathLib = require( 'path' );
const _ = require( 'underscore' );
const Promise = require( 'bluebird' );
const yamlLib = require( 'js-yaml' );
const fs = require( 'fs' );
const Err = require( '../err' );
const checkType = require( '../input-validator' );

Promise.promisifyAll( fs );

/**
 * Load source from opts config
 *
 * @param {Object} opts
 * @param {Object|string} opts.yaml
 * @param {Object} opts.yamlSetAttrs
 * @param {Object} opts.yamlSetParams
 * @param {Object} opts.yamlLayers
 * @param {Object} opts.yamlExceptLayers
 * @param {Object} opts.yamlSetDataSource
 * @param {Function} valueResolver
 * @param {Function} [logger]
 * @constructor
 */
function YamlLoader( opts, valueResolver, logger ) {
	this._resolveValue = valueResolver;
	this._opts = opts;
	this._log = logger || ( () => {} );
}

/**
 * @param {string} protocol
 * @return {Promise.<string>}
 */
YamlLoader.prototype.load = function load( protocol ) {
	const self = this;
	const opts = this._opts;
	let yamlFile = self._resolveValue( opts.yaml, 'yaml', true );

	if ( typeof yamlFile === 'object' ) {
		// this is a module loader, allow it to update loading options
		yamlFile.module.apply( opts, yamlFile.params );
		( { yamlFile } = opts );
	}

	return fs.readFileAsync( yamlFile, 'utf8' )
		.then( ( yaml ) => self.update( yaml, yamlFile ) )
		.then( ( yaml ) =>
		// override all query params except protocol
			( {
				protocol,
				yaml,
				base: pathLib.dirname( yamlFile ),
				pathname: pathLib.dirname( yamlFile ),
				hostname: '/'
			} ) );
};

// returns a function that will test a layer for being in a list (or not in a list)
function getLayerFilter( opts, getLayerId ) {
	const include = checkType( opts, 'yamlLayers', 'string-array' );
	const exclude = checkType( opts, 'yamlExceptLayers', 'string-array' );
	if ( !include && !exclude ) {
		return undefined;
	}
	if ( include && exclude ) {
		throw new Err( 'YamlLoader: it may be either yamlLayers or yamlExceptLayers, not both' );
	}
	const layers = include ? opts.yamlLayers : opts.yamlExceptLayers;
	if ( !Array.isArray( layers ) ) {
		throw new Err( 'YamlLoader yamlLayers/yamlExceptLayers must be a string or an array of strings' );
	}
	return ( layer ) => _.contains( layers, getLayerId( layer ) ) === include;
}

/**
 * Actually perform the YAML modifications
 *
 * @param {string} yamlData string YAML
 * @param {string} yamlFile the name of the yaml file to include in errors
 * @return {string} modified yaml string
 */
YamlLoader.prototype.update = function update( yamlData, yamlFile ) {
	const self = this;
	const opts = self._opts;
	const isSource = opts.uri === 'tmsource://';
	const layersProp = isSource ? 'Layer' : 'layers';
	const getLayerId = isSource ?
		( layer ) => layer.id :
		( layer ) => layer;

	if ( !opts.yamlSetParams && !opts.yamlLayers &&
        !opts.yamlExceptLayers && !opts.yamlSetDataSource
	) {
		return yamlData;
	}

	const doc = yamlLib.safeLoad( yamlData );

	// 'yamlSetParams' overrides parameter values. Usage:
	//    yamlSetParams: { 'maxzoom': 20, 'source': {'ref':'v1gen'} }
	if ( checkType( opts, 'yamlSetParams', 'object' ) ) {
		_.each( opts.yamlSetParams, ( value, name ) => {
			doc[ name ] = self._resolveValue( value, name );
		} );
	}

	// 'yamlLayers' selects just the layers specified by a list (could be a single string)
	// Remove layers that were not listed in the layer parameter. Keep all non-layer elements.
	// Alternatively, use 'yamlExceptLayers' to exclude a list of layers.
	//    layers: ['waterway', 'building']
	const layerFunc = getLayerFilter( opts, getLayerId );
	if ( layerFunc ) {
		doc[ layersProp ] = doc[ layersProp ].filter( layerFunc );
	}

	// 'yamlSetDataSource' allows alterations to the datasource parameters in each layer.
	// could be an object or an array of objects
	// use 'if' to provide a set of values to match, and 'set' to change values
	if ( checkType( opts, 'yamlSetDataSource', 'object' ) ) {
		let dataSources = opts.yamlSetDataSource;
		if ( typeof dataSources === 'object' && !Array.isArray( dataSources ) ) {
			dataSources = [ dataSources ];
		}
		_.each( dataSources, ( ds ) => {
			if ( typeof ds !== 'object' || Array.isArray( ds ) ) {
				throw new Err( 'YamlLoader: yamlSetDataSource must be an object' );
			}
			let conditions = false;
			if ( checkType( ds, 'if', 'object' ) ) {
				conditions = _.mapObject(
					ds.if,
					( value, key ) => self._resolveValue( value, key )
				);
			}
			doc[ layersProp ].forEach( ( yamlLayer ) => {
				const layerDatasource = yamlLayer.Datasource;
				if ( !layerDatasource ) {
					self._log(
						'warn', 'Datasource yaml element was not found in layer %j in %j',
						yamlLayer.id, yamlFile
					);
					return;
				}
				if ( conditions ) {
					if ( !_.all( conditions, ( val, key ) => layerDatasource[ key ] === val ) ) {
						return;
					}
				}
				self._log( 'trace', `Updating layer ${yamlLayer.id}` );
				checkType( ds, 'set', 'object', true );
				_.each( ds.set, ( value, name ) => {
					layerDatasource[ name ] = self._resolveValue( value, name );
				} );
			} );
		} );
	}

	return yamlLib.safeDump( doc );
};

module.exports = YamlLoader;
