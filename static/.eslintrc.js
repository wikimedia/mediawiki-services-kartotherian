module.exports = {
  root: true,
  ignorePatterns: [ 'lib/*' ],
  extends: 'wikimedia/client',
  env: {
    node: false,
  },
  globals: {
    L: false
  },
};
