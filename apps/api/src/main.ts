import { createApp } from "./app.ts";
import { config } from "./config.ts";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
const keepAlive = setInterval(() => undefined, 60_000);

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

function stop() {
  clearInterval(keepAlive);
  server.close(() => {
    process.exit(0);
  });
}
