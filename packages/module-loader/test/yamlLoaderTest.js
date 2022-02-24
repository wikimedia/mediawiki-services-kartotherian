const assert = require('assert');
const jsYaml = require('js-yaml');
const { YamlLoader } = require('..');

function test(opts, expected) {
  return () => {
    const options = opts || {};
    options.uri = options.uri || 'tmsource://';
    const loader = new YamlLoader(options, v => v);
    const actual = loader.update(jsYaml.safeDump(options.yaml));
    assert.strictEqual(actual, jsYaml.safeDump(expected));
  };
}

function yaml(opts) {
  const options = opts || {};
  options.format = options.format || 'tmsource';

  const docs = {
    tmsource: {
      description: 'sample tmsource yaml',
      Layer: [
        {
          id: 'landuse',
          Datasource: {
            dbname: 'gis',
            host: '',
            type: 'postgis',
          },
        },
        {
          id: 'other_layer',
          Datasource: {
            host: '',
            type: 'postgis',
          },
        },
      ],
    },
    tmstyle: {
      description: 'sample tmstyle yaml',
      layers: [
        'landuse',
        'other_layer',
      ],
    },
  };

  return docs[options.format];
}

describe('yamlLoader', () => {
  it('unmodified', test({ yaml: 'abc' }, 'abc'));

  it('yamlSetDataSource', test({
    yaml: yaml(),
    yamlSetDataSource: {
      if: {
        dbname: 'gis',
        host: '',
        type: 'postgis',
      },
      set: {
        host: 'localhost',
        user: 'username',
        password: 'password',
      },
    },
  }, {
    description: 'sample tmsource yaml',
    Layer: [
      {
        id: 'landuse',
        Datasource: {
          dbname: 'gis',
          host: 'localhost',
          type: 'postgis',
          user: 'username',
          password: 'password',
        },
      },
      {
        id: 'other_layer',
        Datasource: {
          host: '',
          type: 'postgis',
        },
      },
    ],
  }));

  it('yamlSetParams', test({
    yaml: yaml(),
    yamlSetParams: {
      source: 'osm-pbf',
    },
  }, {
    description: 'sample tmsource yaml',
    Layer: [
      {
        id: 'landuse',
        Datasource: {
          dbname: 'gis',
          host: '',
          type: 'postgis',
        },
      },
      {
        id: 'other_layer',
        Datasource: {
          host: '',
          type: 'postgis',
        },
      },
    ],
    source: 'osm-pbf',
  }));

  it('yamlLayers (tmsource)', test({
    yaml: yaml(),
    yamlLayers: ['other_layer'],
  }, {
    description: 'sample tmsource yaml',
    Layer: [
      {
        id: 'other_layer',
        Datasource: {
          host: '',
          type: 'postgis',
        },
      },
    ],
  }));

  it('yamlLayers (tmstyle)', test({
    uri: 'tmstyle://',
    yaml: yaml({ format: 'tmstyle' }),
    yamlLayers: ['other_layer'],
  }, {
    description: 'sample tmstyle yaml',
    layers: ['other_layer'],
  }));

  it('yamlExceptLayers (tmsource)', test({
    yaml: yaml(),
    yamlExceptLayers: ['other_layer'],
  }, {
    description: 'sample tmsource yaml',
    Layer: [
      {
        id: 'landuse',
        Datasource: {
          dbname: 'gis',
          host: '',
          type: 'postgis',
        },
      },
    ],
  }));

  it('yamlExceptLayers (tmstyle)', test({
    uri: 'tmstyle://',
    yaml: yaml({ format: 'tmstyle' }),
    yamlExceptLayers: ['other_layer'],
  }, {
    description: 'sample tmstyle yaml',
    layers: ['landuse'],
  }));
});
