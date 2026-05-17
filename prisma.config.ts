import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "packages/datastore/prisma/schema.prisma",
  migrations: {
    path: "packages/datastore/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
