import { spawnSync } from "node:child_process";

const result = spawnSync(
  "yarn",
  ["prisma:generate"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://track_lab:track_lab@localhost:5432/track_lab?schema=public",
    },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
