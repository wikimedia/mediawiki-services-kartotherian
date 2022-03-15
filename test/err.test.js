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
const assert = require( 'assert' );
const Err = require( '../lib/err' );

describe( 'Err', () => {
	it( 'basic', () => {
		try {
			throw new Err();
		} catch ( err ) {
			assert.ok( err instanceof Err );
			assert.strictEqual( err.message, 'unknown' );
			assert.strictEqual( err.name, 'Err' );
		}
		try {
			throw new Err( 'abc' );
		} catch ( err ) {
			assert.strictEqual( err.message, 'abc' );
		}
	} );
	it( 'format', () => {
		try {
			throw new Err( 'a=%d', 10 );
		} catch ( err ) {
			assert.strictEqual( err.message, 'a=10' );
		}
		try {
			throw new Err( 'a=%d' );
		} catch ( err ) {
			assert.strictEqual( err.message, 'a=%d' );
		}
		try {
			throw new Err( 'a=%d, b=%d', 10 );
		} catch ( err ) {
			assert.strictEqual( err.message, 'a=10, b=%d' );
		}
	} );
	it( 'metrics', () => {
		try {
			throw new Err( 'a' ).metrics( 'abc' );
		} catch ( err ) {
			assert.strictEqual( err.message, 'a' );
			assert.strictEqual( err.metrics, 'abc' );
		}
		try {
			throw new Err( 'a=%d', 10 ).metrics( 'abc' );
		} catch ( err ) {
			assert.strictEqual( err.message, 'a=10' );
			assert.strictEqual( err.metrics, 'abc' );
		}
	} );
	it( 'throwNoTile', () => {
		let thrown = true;
		try {
			Err.throwNoTile();
			thrown = false;
		} catch ( err ) {
			assert( err instanceof Error, 'must be error' );
			assert.strictEqual( Err.isNoTileError( err ), true, 'isNoTileError' );
		}
		assert.strictEqual( thrown, true, 'throwNoTile() didn\'t throw' );
		assert.strictEqual( Err.isNoTileError( new Error( 'Tile does not exist' ) ), true, 'newErr' );
		assert.strictEqual( Err.isNoTileError( new Error( ' Tile does not exist' ) ), false, 'newErr2' );
	} );
} );
