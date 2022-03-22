module.exports = {
	root: true,
	extends: 'wikimedia/server',
	parserOptions: {
		ecmaVersion: 2018
	},
	rules: {
		'valid-jsdoc': 'off',
		'no-underscore-dangle': 'off',
		'max-statements-per-line': [ 'error', { max: 2 } ],
		camelcase: 'off'
	}
};
