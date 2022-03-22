const assert = require( 'assert' );
const { XmlLoader } = require( '../../lib/module-loader' );

function test( opts, expected ) {
	return () => {
		const loader = new XmlLoader( opts, ( v ) => v.ref );
		const xmlResult = loader.update( opts.xml );
		assert.strictEqual( xmlResult, expected );
	};
}

function xml( opts ) {
	const options = opts || {};

	if ( options.source === undefined ) {
		options.source = '<![CDATA[<a/>]]>';
	}
	const source = !options.source ? '' : `<Parameter name="source">${options.source}</Parameter>`;

	const layerOptional = options.excludeOptional ? '' : '<Layer name="layerOptional"><StyleName>Optional</StyleName></Layer>';

	return `<?xml version="1.0" encoding="UTF-8"?>
<Map srs="abc"${options.attrs || ''}><Parameters><Parameter name="attribution"><![CDATA[<a/>]]></Parameter>${source}</Parameters><Layer name="layerAlways"><StyleName>Always</StyleName></Layer>${layerOptional}</Map>
`;
}

describe( 'xmlLoader', () => {
	it( 'unmodified', test( { xml: 'abc' }, 'abc' ) );

	it( 'xmlSetParams', test( {
		xml: xml(),
		xmlSetParams: {
			source: { ref: 'sourceId' }
		}
	}, xml( { source: 'sourceId' } ) ) );

	it( 'xmlSetParams new', test( {
		xml: xml( { source: null } ),
		xmlSetParams: {
			source: { ref: 'sourceId' }
		}
	}, xml( { source: 'sourceId' } ) ) );

	it( 'xmlSetAttrs', test( {
		xml: xml(),
		xmlSetAttrs: {
			attr: { ref: 'abc' }
		}
	}, xml( { attrs: ' attr="abc"' } ) ) );

	it( 'xmlLayers', test( {
		xml: xml(),
		xmlLayers: [ 'layerAlways' ]
	}, xml( { excludeOptional: true } ) ) );

	it( 'xmlExceptLayers', test( {
		xml: xml(),
		xmlExceptLayers: [ 'layerOptional' ]
	}, xml( { excludeOptional: true } ) ) );
} );
