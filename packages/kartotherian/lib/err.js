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
const util = require('util');

/**
 * Creates a formatted error info
 * @param message
 * @returns {Err}
 * @constructor
 */
function Err(...messageParams) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = messageParams.length < 2
    ? (messageParams[0] || 'unknown')
    : util.format.apply(null, messageParams);
}

util.inherits(Err, Error);

Err.prototype.metrics = function metricsFunc(metrics) {
  this.metrics = metrics;
  return this;
};

/**
 * Throw "standard" tile does not exist error.
 * The error message string is often used to check if tile existance, so it has to be exact
 */
Err.throwNoTile = function throwNoTile() {
  throw new Error('Tile does not exist');
};

/**
 * Checks if the error indicates the tile does not exist
 */
Err.isNoTileError = function isNoTileError(err) {
  return err.message === 'Tile does not exist';
};


module.exports = Err;
