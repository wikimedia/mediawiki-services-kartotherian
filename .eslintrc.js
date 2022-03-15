module.exports = {
  root: true,
  extends: 'wikimedia/server',
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'valid-jsdoc': 'off',
    'no-underscore-dangle': 'off',
    'max-statements-per-line': [ 'error', { 'max': 2 } ],
    'camelcase': 'off',

    // Dangling commas are not supported for functions in node before v8.x
    'comma-dangle': [
      'error',
      {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never',
      },
    ],
  },
};
