const pathLib = require('path');
const _ = require('underscore');
const Promise = require('bluebird');
const libxmljs = require('libxmljs');
const fs = require('fs');
const Err = require('@wikimedia/err');
const checkType = require('@wikimedia/kartotherian-input-validator');

Promise.promisifyAll(fs);

/**
 * Load source from opts config
 * @param {object} opts
 * @param {object|string} opts.xml
 * @param {object} opts.xmlSetAttrs
 * @param {object} opts.xmlSetParams
 * @param {object} opts.xmlLayers
 * @param {object} opts.xmlExceptLayers
 * @param {object} opts.xmlSetDataSource
 * @param {function} valueResolver
 * @param {function} [logger]
 * @constructor
 */
function XmlLoader(opts, valueResolver, logger) {
  this._resolveValue = valueResolver;
  this._opts = opts;
  this._log = logger || (() => {});
}

/**
 * @param {string} protocol
 * @return {Promise.<string>}
 */
XmlLoader.prototype.load = function load(protocol) {
  const self = this;
  const opts = this._opts;
  let xmlFile = self._resolveValue(opts.xml, 'xml', true);

  if (typeof xmlFile === 'object') {
    // this is a module loader, allow it to update loading options
    xmlFile.module.apply(opts, xmlFile.params);
    ({ xmlFile } = opts);
  }

  return fs.readFileAsync(xmlFile, 'utf8')
    .then(xml => self.update(xml, xmlFile))
    .then(xml =>
    // override all query params except protocol
      ({
        protocol,
        xml,
        base: pathLib.dirname(xmlFile),
      }));
};

// returns a function that will test a layer for being in a list (or not in a list)
function getLayerFilter(opts) {
  const include = checkType(opts, 'xmlLayers', 'string-array');
  const exclude = checkType(opts, 'xmlExceptLayers', 'string-array');
  if (!include && !exclude) {
    return undefined;
  }
  if (include && exclude) {
    throw new Err('XmlLoader: it may be either xmlLayers or xmlExceptLayers, not both');
  }
  const layers = include ? opts.xmlLayers : opts.xmlExceptLayers;
  if (!Array.isArray(layers)) {
    throw new Err('XmlLoader xmlLayers/xmlExceptLayers must be a string or an array of strings');
  }
  return xmlChild => _.contains(layers, xmlChild.attr('name').value()) === include;
}

/**
 * Actually perform the XML modifications
 * @param {string} xmlData string XML
 * @param {string} xmlFile the name of the xml file to include in errors
 * @return {string} modified xml string
 */
XmlLoader.prototype.update = function update(xmlData, xmlFile) {
  const self = this;
  const opts = self._opts;
  if (!opts.xmlSetAttrs && !opts.xmlSetParams && !opts.xmlLayers &&
        !opts.xmlExceptLayers && !opts.xmlSetDataSource
  ) {
    return xmlData;
  }
  const doc = libxmljs.parseXmlString(xmlData, { noblanks: true });

  // 'xmlSetAttrs' overrides root attributes. Usage:
  //    xmlSetAttrs: { 'font-directory': 'string' }
  if (checkType(opts, 'xmlSetAttrs', 'object')) {
    self._setXmlAttributes(opts.xmlSetAttrs, doc.root());
  }

  // 'xmlSetParams' overrides root parameter values. Usage:
  //    xmlSetParams: { 'maxzoom': 20, 'source': {'ref':'v1gen'} }
  if (checkType(opts, 'xmlSetParams', 'object')) {
    const xmlParams = doc.root().get('Parameters');
    if (!xmlParams) {
      throw new Err('<Parameters> xml element was not found in %j', xmlFile);
    }
    self._setXmlParameters(doc, opts.xmlSetParams, xmlParams, xmlFile);
  }

  // 'xmlLayers' selects just the layers specified by a list (could be a single string)
  // Remove layers that were not listed in the layer parameter. Keep all non-layer elements.
  // Alternatively, use 'xmlExceptLayers' to exclude a list of layers.
  //    layers: ['waterway', 'building']
  const optLayerFunc = getLayerFilter(opts);
  if (optLayerFunc) {
    doc.childNodes().forEach((xmlChild) => {
      if (xmlChild.name() === 'Layer' && !optLayerFunc(xmlChild)) {
        xmlChild.remove();
      }
    });
  }

  // 'xmlSetDataSource' allows alterations to the datasource parameters in each layer.
  // could be an object or an array of objects
  // use 'if' to provide a set of values to match, and 'set' to change
  // values, xmlLayers/xmlExceptLayers filters
  if (checkType(opts, 'xmlSetDataSource', 'object')) {
    let dataSources = opts.xmlSetDataSource;
    if (typeof dataSources === 'object' && !Array.isArray(dataSources)) {
      dataSources = [dataSources];
    }
    _.each(dataSources, (ds) => {
      if (typeof ds !== 'object' || Array.isArray(ds)) {
        throw new Err('XmlLoader: xmlSetDataSource must be an object');
      }
      const layerFunc = getLayerFilter(ds);
      let conditions = false;
      if (checkType(ds, 'if', 'object')) {
        conditions = _.mapObject(ds.if, (value, key) => self._resolveValue(value, key));
      }
      doc.eachChild((xmlLayer) => {
        if (xmlLayer.name() !== 'Layer' || (layerFunc && !layerFunc(xmlLayer))) {
          return;
        }
        const xmlParams = xmlLayer.get('Datasource');
        if (!xmlParams) {
          self._log(
            'warn', '<Datasource> xml element was not found in layer %j in %j',
            xmlLayer.attr('name').value(), xmlFile
          );
          return;
        }
        if (conditions) {
          if (!_.all(conditions, (val, key) =>
            self._xmlParamByName(doc, xmlParams, key, xmlFile).text(val))
          ) {
            return;
          }
        }
        self._log('trace', `Updating layer ${xmlLayer.attr('name').value()}`);
        checkType(ds, 'set', 'object', true);
        self._setXmlParameters(doc, ds.set, xmlParams, xmlFile);
      });
    });
  }

  return doc.toString({ cdata: true });
};

/**
 * @param {xmldoc.XmlDocument} xmlParams
 * @param {string} name
 * @param {string} xmlFile
 * @param {boolean} [createIfMissing]
 * @private
 */
XmlLoader.prototype._xmlParamByName = function _xmlParamByName(
  doc,
  xmlParams,
  name,
  xmlFile,
  createIfMissing
) {
  let param = xmlParams.get(`*[@name='${name}']`);
  if (!param || param.name() !== 'Parameter') {
    if (!createIfMissing) {
      throw new Err('<Parameter name=%j> xml element was not found in %j', name, xmlFile);
    }
    param = new libxmljs.Element(doc, 'Parameter');
    param.attr({ name });
    xmlParams.addChild(param);
  }
  return param;
};

XmlLoader.prototype._setXmlAttributes = function _setXmlAttributes(newValues, xmlElement) {
  const self = this;
  _.each(newValues, (value, name) => {
    const attr = {};
    attr[name] = self._resolveValue(value, name);
    xmlElement.attr(attr);
  });
};

XmlLoader.prototype._setXmlParameters = function _setXmlParameters(
  doc,
  newValues,
  xmlParams,
  xmlFile
) {
  const self = this;
  _.each(newValues, (value, name) => {
    const param = self._xmlParamByName(doc, xmlParams, name, xmlFile, true);
    param.text(self._resolveValue(value, name));
  });
};

module.exports = XmlLoader;
