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
