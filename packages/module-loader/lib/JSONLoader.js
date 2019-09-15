'use strict';

let pathLib = require('path'),
    Promise = require('bluebird'),
    fs = require("fs"),
    Err = require('@kartotherian/err'),
    checkType = require('@kartotherian/input-validator');

Promise.promisifyAll(fs);

module.exports = JSONLoader;

/**
 * Load source from opts config
 * @param {object} opts
 * @param {object|string} opts.yaml
 * @param {object} opts.yamlSetAttrs
 * @param {object} opts.yamlSetParams
 * @param {object} opts.yamlLayers
 * @param {object} opts.yamlExceptLayers
 * @param {object} opts.yamlSetDataSource
 * @param {function} valueResolver
 * @param {function} [logger]
 * @constructor
 */
function JSONLoader(opts, valueResolver, logger) {
    this._resolveValue = valueResolver;
    this._opts = opts;
    this._log = logger || (() => {});
}

/**
 * @param {string} protocol
 * @return {Promise.<string>}
 */
JSONLoader.prototype.load = function load(protocol) {
    let self = this,
        opts = this._opts,
        jsonFile = self._resolveValue(opts.json, 'json', true);

//    if (typeof jsonFile === 'object') {
//        // this is a module loader, allow it to update loading options
//        jsonFile.module.apply(opts, jsonFile.params);
//        jsonFile = opts.jsonFile;
//    }

    return fs.readFileAsync(jsonFile, 'utf8')
        .then(json => {
            // override all query params except protocol
            return {
                protocol: protocol,
                json: json,
                base: pathLib.dirname(jsonFile),
                pathname: pathLib.dirname(jsonFile),
                hostname: '/'
            };
        });
};