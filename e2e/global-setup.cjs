const { hasSeededE2EApi, startE2EEnvironment } = require("./test-environment.cjs");

module.exports = async function globalSetup() {
  if (await hasSeededE2EApi()) return;
  return startE2EEnvironment();
};