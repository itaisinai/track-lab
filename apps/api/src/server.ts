import { createApp } from "./app.ts";
import { config } from "./config.ts";

const app = createApp();

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
