'use strict';

const pathLib = require( 'path' );
const _ = require( 'underscore' );
const Promise = require( 'bluebird' );
const yaml = require( 'js-yaml' );
const fs = require( 'fs' );
const Err = require( './err' );
const checkType = require( './input-validator' );
const core = require( './core' );
const { XmlLoader, YamlLoader } = require( './module-loader' );

Promise.promisifyAll( fs );

// constant
const sourceByRefProtocol = 'sourceref:';

function Sources() {
	this._variables = {};
	this._sources = {};

	// Set up a ref protocol resolver - this way its enough to specify the source
	// by sourceref:///?ref=sourceID URL, instead of a full source URL.
	const self = this;

	// ATTENTION: this must be a non-anonymous function, as it is a constructor
	core.tilelive.protocols[ sourceByRefProtocol ] = function tileLiveProtocols( uri, callback ) {
		Promise.try( () => {
			uri = checkType.normalizeUrl( uri );
			if ( !uri.query.ref ) {
				throw new Err( 'ref uri parameter is not set' );
			}
			return self.getHandlerById( uri.query.ref );
		} ).nodeify( callback );
	};
}

/**
 * Regex string to match proper source IDs
 *
 * @type {string}
 */
Sources.sourceIdReStr = '[A-Za-z][-A-Za-z0-9_]*';

/**
 * Precompiled regex to match source ID as a full string
 *
 * @type {RegExp}
 */
Sources.sourceIdRe = new RegExp( `^${Sources.sourceIdReStr}$` );

/**
 * Source ID must begin with a letter, and may contain letters, digits, and underscores
 *
 * @param sourceId
 */
Sources.isValidSourceId = function isValidSourceId( sourceId ) {
	return typeof sourceId === 'string' && sourceId.length > 0 && Sources.sourceIdRe.test( sourceId );
};

/**
 * Load both variables and sources in one function call
 *
 * @param {Object} conf
 * @param {Object|string} conf.modules
 * @param {Object|string} conf.variables
 * @param {Object|string} conf.sources
 * @return {*}
 */
Sources.prototype.init = function init( conf ) {
	const self = this;
	return Promise.try( () => {
		if ( !conf.modules ) {
			throw new Err( 'Configuration must have a "modules" parameter listing all ' +
                'Tilelive/Kartotherian NPM plugin modules' );
		}
		_.each( conf.modules, core.registerTileliveModule );
		self.loadVariablesAsync( self._localOrExternalDataAsync( conf.variables, 'variables' ) );
	} ).then( () =>
		self.loadSourcesAsync( self._localOrExternalDataAsync( conf.sources, 'sources' ) ) ).return( self );
};

/**
 * Load variables (e.g. passwords, etc)
 *
 * @param variables
 * @return {*}
 */
Sources.prototype.loadVariablesAsync = function loadVariablesAsync( variables ) {
	const self = this;
	// TODO: Fix this shadow properly
	// eslint-disable-next-line no-shadow
	return Promise.resolve( variables ).then( ( variables ) => {
		self._variables = _.extend( self._variables, variables );
	} );
};

Sources.prototype.loadSourcesAsync = function loadSourcesAsync( sources ) {
	const self = this;
	// TODO: Fix this shadow properly
	// eslint-disable-next-line no-shadow
	return Promise.resolve( sources ).then( ( sources ) => {
		if ( !_.isObject( sources ) || _.isArray( sources ) ) {
			throw new Err( 'Sources must be an object' );
		}
		return Promise.each(
			Object.keys( sources ),
			( key ) => self._loadSourceAsync( sources[ key ], key )
		);
	} );
};

/**
 * Override top-level values in the info object with the ones
 * from override object, or delete on null
 *
 * @param {Object} info
 * @param {Object} override
 * @param {Object} [source] if given, sets min/max zoom
 * @param {string} [sourceId]
 */
function updateInfo( info, override, source, sourceId ) {
	if ( source ) {
		if ( source.minzoom !== undefined ) {

			info.minzoom = source.minzoom;
		}
		if ( source.maxzoom !== undefined ) {

			info.maxzoom = source.maxzoom;
		}
	}
	if ( sourceId !== undefined ) {

		info.name = sourceId;
	}
	if ( override ) {
		_.each( override, ( v, k ) => {
			if ( v === null ) {
				// When override.key == null, delete that key

				delete info[ k ];
			} else {
				// override info of the parent

				info[ k ] = v;
			}
		} );
	}
}

/**
 * Load source from src config
 *
 * @param {Object} src
 * @param {string|Object} src.uri
 * @param {Object} src.params
 * @param {boolean} src.public
 * @param {int} src.minzoom
 * @param {int} src.maxzoom
 * @param {Object} src.defaultHeaders
 * @param {Object} src.headers
 * @param {string[]} src.formats
 * @param {int[]} src.scales
 * @param {boolean} src.static
 * @param {int} src.maxwidth
 * @param {int} src.maxheight
 * @param {string} src.pathname
 * @param {Object|string} src.xml
 * @param {Object} src.xmlSetAttrs
 * @param {Object} src.xmlSetParams
 * @param {Object} src.xmlLayers
 * @param {Object} src.xmlExceptLayers
 * @param {Object} src.xmlSetDataSource
 * @param {Object|string} src.yaml
 * @param {Object} src.yamlSetParams
 * @param {Object} src.yamlLayers
 * @param {Object} src.yamlExceptLayers
 * @param {Object} src.yamlSetDataSource
 * @param {Object} src.setInfo
 * @param {Object} src.overrideInfo
 * @param sourceId
 * @return {Promise}
 * @private
 */
Sources.prototype._loadSourceAsync = function _loadSourceAsync( src, sourceId ) {
	const self = this;
	return Promise.try( () => {
		if ( !Sources.isValidSourceId( sourceId ) ) {
			throw new Err( 'sourceId %j must only contain letters and digits', sourceId );
		}
		if ( typeof src !== 'object' ) {
			throw new Err( 'source %j must be an object', sourceId );
		}

		checkType( src, 'uri', 'string', true, 1 );
		const uri = checkType.normalizeUrl( src.uri );

		// These params are stored, but not acted on within core
		// Kartotherian service uses them when handling user's requests
		// If public is not true, the rest of the values are unused
		checkType( src, 'public', 'boolean' );
		checkType( src, 'minzoom', 'zoom' );
		checkType( src, 'maxzoom', 'zoom' );
		checkType( src, 'defaultHeaders', 'object' );
		checkType( src, 'headers', 'object' );
		checkType( src, 'formats', 'string-array' );
		if ( checkType( src, 'scales', 'number-array' ) ) {
			// store scales as an array of strings because it
			// must be an exact match - optimizes caching
			if ( src.scales.length === 0 ) {

				delete src.scales;
			} else {

				src.scales = _.map( src.scales, ( v ) => v.toString() );
			}
		}
		checkType( src, 'static', 'boolean' );
		checkType( src, 'maxwidth', 'integer' );
		checkType( src, 'maxheight', 'integer' );

		/**
		 * Inject info properties into the URI objects to make tilelive-http [1]
		 * accept maxzoom and minzoom properties - T297753
		 * [1] https://github.com/mojodna/tilelive-http/blob/master/index.js#L133
		 */
		if ( checkType( src, 'setInfo', 'object' ) || checkType( src, 'overrideInfo', 'object' ) ) {
			const info = src.overrideInfo || src.setInfo;
			_.each( info, ( v, k ) => {
				uri.info[ k ] = self._resolveValue( v, k );
			} );
		}

		// Add URI query values, e.g.  ?password=...
		if ( checkType( src, 'params', 'object' ) ) {
			_.each( src.params, ( v, k ) => {
				uri.query[ k ] = self._resolveValue( v, k );
			} );
		}
		// Set URI's path, e.g. /srv/data/myDir
		if ( checkType( src, 'pathname', 'object' ) ) {
			uri.pathname = self._resolveValue( src.pathname, 'pathname' );
		}
		if ( src.xml ) {
			const xmlLoader = new XmlLoader( src, self._resolveValue.bind( self ), core.log );
			return xmlLoader.load( uri.protocol );
		}
		if ( src.yaml ) {
			const yamlLoader = new YamlLoader( src, self._resolveValue.bind( self ), core.log );
			return yamlLoader.load( uri.protocol );
		}
		return uri;
	} ).then( ( uri ) => core.loadSource( uri ) ).then( ( handler ) => {
		const info = {
			// This is the only required field per spec, and it can be overwritten
			// https://github.com/mapbox/tilejson-spec
			tilejson: '2.1.0'
		};

		// minzoom/maxzoom is automatically added before
		// setInfo and overrideInfo if setInfo is given
		// but it is added after calling original getInfo() if setInfo is not given
		if ( src.setInfo ) {
			updateInfo( info, src.setInfo, src, sourceId );
			updateInfo( info, src.overrideInfo );
			return [ handler, info ];
		}
		return handler.getInfoAsync().then( ( sourceInfo ) => {
			updateInfo( info, sourceInfo );
			updateInfo( info, src.overrideInfo, src, sourceId );
			return [ handler, info ];
		} );
	} ).spread( ( handler, info ) => {

		handler.getInfo = ( callback ) => {
			callback( undefined, info );
		};

		handler.getInfoAsync = Promise.promisify( handler.getInfo );

		src.getHandler = () => handler;
	} )
		.catch( ( err ) => {

			err.message = `Unable to create source "${sourceId}"${err.message || ''}`;
			core.log( 'error', err );

			src.isDisabled = err || true;
		} )
		.then( () => {
			self._sources[ sourceId ] = src;
		} );
};

Sources.prototype._localOrExternalDataAsync = function _localOrExternalDataAsync( values, name ) {
	return Promise.try( () => {
		if ( values === undefined ) {
			core.log( 'info', `${name} is not set in the config file` );
			return {};
		}
		if ( !Array.isArray( values ) ) {

			values = [ values ];
		}

		values = _.map( values, ( value ) => {
			if ( typeof value === 'string' ) {
				const path = pathLib.resolve( core.getAppRootDir(), value );
				core.log( 'info', `Loading ${name} from ${path}` );
				return fs
					.readFileAsync( path )
					.then( yaml.safeLoad );
			} else if ( typeof value === 'object' && !Array.isArray( value ) ) {
				core.log( 'info', `Loading ${name} from the config file` );
				return value;
			}
			throw new Err( 'config.%s must be an object or filename,' +
                    ' or an array of objects and/or filenames', name );
		} );

		return Promise.reduce( values, _.extend, {} );
	} );
};

/**
 * Resolves a config value into a string. If value is an object with exactly one
 * known key, it resolves it accordingly, otherwise it returns the value as-is.
 * For an array, each value is resolved separately.
 *
 * Supported keys are:
 *
 *  - npm (alias: npmpath): value should be the name npm module, it returns the path
 *
 *  - ref: value should be the name of a source defined in the sources section
 *         of the configuration file
 *
 *  - var: value should be the name of a variable defined in the variables section
 *         of the configuration file
 *
 *  - env: value should be the name of an environment variable
 *
 *  - loader (alias: npmloader): value should be the name of an npm module,
 *                               it returns the loaded module
 *
 * @param {*} value
 * @param {string} valueName
 * @param {boolean} allowLoader
 * @return {string|Object}
 * @private
 */
Sources.prototype._resolveValue = function _resolveValue( value, valueName, allowLoader ) {
	const self = this;
	if ( typeof value !== 'object' ) {
		return value;
	}
	if ( Array.isArray( value ) ) {
		return _.map( value, ( v ) => self._resolveValue( v, valueName, allowLoader ) );
	}

	const keys = _.keys( value );
	if ( keys.length === 1 ) {
		const firstKey = keys[ 0 ];
		const firstValue = value[ firstKey ];
		switch ( firstKey ) {
			case 'npm':
			case 'npmpath':
				return this.getModulePath( firstValue );
			case 'ref':
				return this._getSourceUri( firstValue );
			case 'var':
				return this._getVariable( firstValue );
			case 'env':
				return this._getEnvVariable( firstValue );
			case 'loader':
			case 'npmloader':
				if ( allowLoader ) {
					return this._getLoader( firstValue );
				}
				break;
			default:
				return value;
		}
	}

	return value;
};

Sources.prototype.getSourceById = function getSourceById( sourceId, dontThrow, allowDisabled ) {
	if (
		!Sources.isValidSourceId( sourceId ) ||
    !Object.prototype.hasOwnProperty.call( this._sources, sourceId )
	) {
		if ( dontThrow ) {
			return undefined;
		}
		throw new Err( 'Unknown source %j', sourceId );
	}

	const source = this._sources[ sourceId ];

	if ( !allowDisabled && source.isDisabled ) {
		if ( dontThrow ) {
			return undefined;
		}
		throw new Err( 'Source %j is disabled, possibly due to loading errors', sourceId );
	}

	return source;
};

Sources.prototype.getHandlerById = function getHandlerById( sourceId, dontThrow ) {
	return this.getSourceById( sourceId, dontThrow ).getHandler();
};

Sources.prototype.getSourceConfigs = function getSourceConfigs() {
	return this._sources;
};

Sources.prototype.getVariables = function getVariables() {
	return this._variables;
};

Sources.prototype._getSourceUri = function _getSourceUri( sourceId ) {
	this.getSourceById( sourceId ); // assert it exists
	return `${sourceByRefProtocol}///?ref=${sourceId}`;
};

Sources.prototype._getVariable = function _getVariable( name ) {
	if ( this._variables[ name ] === undefined ) {
		throw new Err( 'Variable %j is not defined', name );
	}
	return this._variables[ name ];
};

Sources.prototype._getEnvVariable = function _getEnvVariable( name ) {
	if ( process.env[ name ] === undefined ) {
		throw new Err( 'Environment variable %j is not set', name );
	}
	return process.env[ name ];
};

Sources.prototype.getModulePath = function getModulePath( moduleName ) {
	let params;
	if ( Array.isArray( moduleName ) ) {
		params = moduleName.slice( 1 );
		moduleName = moduleName[ 0 ];
	} else if ( typeof moduleName === 'string' ) {
		params = [];
	} else {
		throw new Err( 'npm module name key must be a string or an array' );
	}
	// remove the name of the startup js file, and use it as path
	params.unshift( pathLib.dirname( core.resolveModule( moduleName ) ) );
	return pathLib.resolve.apply( undefined, params );
};

/**
 * Given a module name, require that module in the context of the main app.
 * Returns loaded module and the optional additional parameters.
 *
 * @param {string|string[]} moduleName
 * @return {Object}
 * @private
 */
Sources.prototype._getLoader = function _getLoader( moduleName ) {
	let params;
	if ( typeof moduleName === 'string' ) {
		params = [];
	} else if ( Array.isArray( moduleName ) ) {
		params = moduleName.slice( 1 );
		moduleName = moduleName[ 0 ];
	}
	if ( typeof moduleName !== 'string' ) {
		throw new Err( 'loader npm module name key must be a string or an array of strings' );
	}
	const module = require( core.resolveModule( moduleName ) );
	if ( typeof module !== 'function' ) {
		throw new Err(
			'loader npm module %j is expected to return a function when loaded',
			moduleName
		);
	}
	return {
		module,
		params
	};
};

module.exports = Sources;
