/**
 * MIT License
 *
 * Copyright (c) 2017 kartotherian
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
'use strict';

const _ = require( 'underscore' );
const qidx = require( 'quadtile-index' );
const qs = require( 'querystring' );
const urllib = require( 'url' );
const Err = require( './err' );

function getDefault( obj, field, mustHave ) {
	if ( mustHave === true ) {
		throw new Err( 'Value %j is missing', field );
	}
	if ( mustHave === false || mustHave === undefined ) {
		delete obj[ field ];
	} else {
		obj[ field ] = mustHave;
	}
	return false;
}

/**
 * Utility method to check the type of the object's property
 *
 * @param {Object|*} obj
 * @param {string} field
 * @param {string} expType
 * @param {boolean|undefined|*} mustHave
 * @param {number} min
 * @param {number} max
 * @return {boolean}
 */
function checkType( obj, field, expType, mustHave, min, max ) {
	let value = typeof ( obj ) === 'object' ? obj[ field ] : obj;
	if ( value === undefined ) {
		return getDefault( obj, field, mustHave );
	}
	// Try to convert value to expected type
	let type = expType[ 0 ] === '[' ? Object.prototype.toString.call( value ) : typeof value;
	if ( type === 'string' ) {
		switch ( expType ) {
			case 'number':
				value = checkType.strToFloat( value );
				type = typeof value;
				break;
			case 'integer':
			case 'zoom':
				obj[ field ] = value = checkType.strToInt( value );
				type = typeof value;
				break;
			case 'boolean':
				obj[ field ] = value = !!value;
				type = typeof value;
				break;
			case 'string-array':
				obj[ field ] = value = [ value ];
				type = typeof value;
				break;
			case 'number-array':
				value = checkType.strToFloat( value );
				type = typeof value;
				if ( type === 'number' ) {
					obj[ field ] = value = [ value ];
				}
				break;
			default:
				break;
		}
	} else if ( type === 'number' && expType === 'number-array' ) {
		obj[ field ] = value = [ value ];
		type = typeof value;
	}

	// validate the type
	let isValid;
	switch ( expType ) {
		case 'string-array':
			if ( !Array.isArray( value ) ||
                !_.all( value, ( v ) => typeof v === 'string' && v.length > 0 )
			) {
				throw new Err( 'Invalid %s param: expecting a string or an array of strings', field );
			}
			break;
		case 'number-array':
			isValid = Array.isArray( value );
			if ( isValid ) {
				value = _.map( value, ( v ) => {
					v = checkType.strToFloat( v );
					if ( typeof v !== 'number' ) {
						isValid = false;
					}
					return v;
				} );
			}
			if ( !isValid ) {
				throw new Err( 'Invalid %s param: expecting a number or an array of numbers', field );
			}
			obj[ field ] = value;
			break;
		case 'array':
			if ( !Array.isArray( value ) ) {
				throw new Err(
					'Invalid %s param type %s given, was expecting an array',
					field, type
				);
			}
			break;
		case 'integer':
			if ( !Number.isInteger( value ) ) {
				throw new Err(
					'Invalid %s param type %s given, was expecting an integer',
					field, type
				);
			}
			break;
		case 'zoom':
			if ( !qidx.isValidZoom( value ) ) {
				throw new Err( 'Invalid %s param - an integer zoom value was expected', field );
			}
			break;
		default:
			if ( type !== expType ) {
				throw new Err(
					'Invalid %s param type %s given, was expecting %s',
					field, type, expType
				);
			}
			break;
	}

	// validate ranges
	switch ( expType ) {
		case 'number':
		case 'integer':
		case 'zoom':
			if ( min !== undefined && value < min ) {
				throw new Err(
					'Invalid %s param - must be at least %d, but given %d',
					field, min, value
				);
			}
			if ( max !== undefined && value > max ) {
				throw new Err(
					'Invalid %s param - must be at most %d, but given %d',
					field, max, value
				);
			}
			break;
		case 'string':
			if ( min !== undefined && value.length < min ) {
				throw new Err(
					'Invalid %s param - the string must be at least %d symbols',
					field, min
				);
			}
			break;
		case 'boolean':
			if ( value === false ) {
				// convert false into undefined
				delete obj[ field ];
				return false;
			}
			break;
		case 'string-array':
		case 'number-array':
			if ( min !== undefined && value.length < min ) {
				throw new Err(
					'Invalid %s param - it must have at least %d values, but given %d',
					field, min, value.length
				);
			}
			if ( max !== undefined && value.length > max ) {
				throw new Err(
					'Invalid %s param - it must have at least %d values, but given %d',
					field, max, value.length
				);
			}
			break;
		default:
			break;
	}

	return true;
}

/**
 * Magical float regex found in http://stackoverflow.com/a/21664614/177275
 *
 * @type {RegExp}
 */
// eslint-disable-next-line security/detect-unsafe-regex
checkType.floatRe = /^-?\d+(?:[.,]\d*?)?$/;

/**
 * Converts value to float if possible, or returns the original
 *
 * @param {string} value
 * @return {number|string}
 */
checkType.strToFloat = function strToFloat( value ) {
	if ( typeof value === 'string' && checkType.floatRe.test( value ) ) {
		return parseFloat( value );
	}
	return value;
};

/**
 * Magical int regex
 *
 * @type {RegExp}
 */
const intRe = /^-?\d+$/;

/**
 * Converts value to integer if possible, or returns the original
 *
 * @param {string} value
 * @return {number|string}
 */
checkType.strToInt = function strToInt( value ) {
	if ( typeof value === 'string' && intRe.test( value ) ) {
		return parseInt( value, 10 );
	}
	return value;
};

/**
 * Parse and normalize URI, ensuring it returns an object with query object field
 *
 * @param {Object|string} uri
 * @return {{query: Object, info: Object}}
 */
checkType.normalizeUrl = function normalizeUrl( uri ) {
	if ( typeof uri === 'string' ) {
		// eslint-disable-next-line n/no-deprecated-api
		uri = urllib.parse( uri, true );
	} else if ( typeof uri.query === 'string' ) {
		uri.query = qs.parse( uri.query );
	}
	uri.query = uri.query || {};

	/**
	 * Allow info property to be injected into the URI objects to make tilelive-http [1]
	 * accept maxzoom and minzoom properties - T297753
	 * [1] https://github.com/mojodna/tilelive-http/blob/master/index.js#L133
	 */
	uri.info = uri.info || {};
	return uri;
};

module.exports = checkType;
