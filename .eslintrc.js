'use strict';

module.exports = {
	root: true,
	extends: 'wikimedia/server',
	parserOptions: {
		ecmaVersion: 2018
	},
	rules: {
		'no-underscore-dangle': 'off',
		'max-statements-per-line': [ 'error', { max: 2 } ],
		camelcase: 'off',

		'jsdoc/require-returns': 'off',
		'jsdoc/no-undefined-types': 'off',
		'jsdoc/check-param-names': 'off',
		'jsdoc/require-param-type': 'off'
	}
};
