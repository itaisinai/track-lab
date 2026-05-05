import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function getDefaultDatabasePath() {
  if (process.env.TRACK_LAB_DB_PATH) {
    return resolve(process.env.TRACK_LAB_DB_PATH);
  }

  return join(findWorkspaceRoot(process.cwd()), "data", "track-lab.sqlite");
}

function findWorkspaceRoot(start: string) {
  let current = resolve(start);

  while (current !== dirname(current)) {
    if (hasWorkspacePackageJson(current)) {
      return current;
    }

    current = dirname(current);
  }

  return resolve(start);
}

function hasWorkspacePackageJson(directory: string) {
  const packageJsonPath = join(directory, "package.json");

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      workspaces?: unknown;
    };
    return Array.isArray(packageJson.workspaces);
  } catch {
    return false;
  }
}
