module.exports = {
  root: true,
  extends: 'wikimedia/server',
  env: {
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'valid-jsdoc': [0],
    'no-underscore-dangle': [0],
    'max-statements-per-line': [0],
    'camelcase': [0],

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
