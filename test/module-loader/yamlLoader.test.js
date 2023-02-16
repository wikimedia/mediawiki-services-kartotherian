'use strict';

const assert = require( 'assert' );
const jsYaml = require( 'js-yaml' );
const { YamlLoader } = require( '../../lib/module-loader' );

function test( opts, expected ) {
	return () => {
		const options = opts || {};
		const loader = new YamlLoader( options, ( v ) => v );
		const actual = loader.update( jsYaml.safeDump( options.yaml ) );
		assert.strictEqual( actual, jsYaml.safeDump( expected ) );
	};
}

function yaml( opts ) {
	const options = opts || {};

	const docs = {
		tmsource: {
			description: 'sample tmsource yaml',
			Layer: [
				{
					id: 'landuse',
					Datasource: {
						dbname: 'gis',
						host: '',
						type: 'postgis'
					}
				},
				{
					id: 'other_layer',
					Datasource: {
						host: '',
						type: 'postgis'
					}
				}
			]
		},
		tmstyle: {
			description: 'sample tmstyle yaml',
			layers: [
				'landuse',
				'other_layer'
			]
		}
	};

	return docs[ options.format ];
}

describe( 'yamlLoader', () => {
	it( 'unmodified', test( { yaml: 'abc' }, 'abc' ) );

	it( 'yamlLayers (tmstyle)', test( {
		uri: 'tmstyle://',
		yaml: yaml( { format: 'tmstyle' } ),
		yamlLayers: [ 'other_layer' ]
	}, {
		description: 'sample tmstyle yaml',
		layers: [ 'other_layer' ]
	} ) );

	it( 'yamlExceptLayers (tmstyle)', test( {
		uri: 'tmstyle://',
		yaml: yaml( { format: 'tmstyle' } ),
		yamlExceptLayers: [ 'other_layer' ]
	}, {
		description: 'sample tmstyle yaml',
		layers: [ 'landuse' ]
	} ) );
} );
