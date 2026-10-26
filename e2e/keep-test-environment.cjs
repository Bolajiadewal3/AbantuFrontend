const { startE2EEnvironment } = require("./test-environment.cjs");

async function main() {
  const stop = await startE2EEnvironment();
  const apiPort = process.env.CAREAPP_E2E_API_PORT || "5144";
  console.log(`CareApp E2E API and disposable PostgreSQL are ready at http://localhost:${apiPort}.`);

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});