module.exports = {
  ignorePatterns: ["lib/*"],
  extends: "wikimedia/client",
  env: {
    node: false,
  },
  globals: {
    L: false
  },
  root: true
};
