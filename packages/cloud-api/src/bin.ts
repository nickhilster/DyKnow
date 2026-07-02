import { createCloudApiServer } from "./server.js";

const port = Number(process.env.DYKNOW_CLOUD_API_PORT ?? "4180");
const host = process.env.DYKNOW_CLOUD_API_HOST ?? "127.0.0.1";

const server = createCloudApiServer();
server.listen(port, host, () => {
  process.stdout.write(
    `DyKnow Cloud API listening on http://${host}:${String(port)}\n`,
  );
});
