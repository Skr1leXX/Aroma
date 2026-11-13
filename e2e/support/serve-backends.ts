// Long-running process for Playwright's webServer: real Postgres + fake Cloudinary, ready when "READY" is printed.
import { startFakeCloudinary } from "./fake-cloudinary";
import { prepare, startPg } from "./pg-server";

async function main() {
  const pg = await startPg();
  await prepare();
  await startFakeCloudinary();
  console.log("READY");
  const stop = async () => {
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
