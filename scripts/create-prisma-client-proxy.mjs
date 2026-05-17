import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const generatedClientProxyPath = resolve(
  "packages/datastore/.prisma/generated/client.js",
);

mkdirSync(dirname(generatedClientProxyPath), { recursive: true });

writeFileSync(
  generatedClientProxyPath,
  'export { PrismaClient, Prisma } from "./client.ts";\n',
);
