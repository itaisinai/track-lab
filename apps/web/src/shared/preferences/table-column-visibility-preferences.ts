import type { VisibilityState } from "@tanstack/react-table";

type TableColumnVisibilityPreferenceRepository = {
  readColumnVisibility(tableId: string): VisibilityState;
  writeColumnVisibility(tableId: string, visibility: VisibilityState): void;
};

// Local persistence adapter for now. This stays behind a repository interface
// so a future DB-backed preference store can swap in without touching callers.
const STORAGE_PREFIX = "track-lab.table-column-visibility";

const inMemoryFallback = new Map<string, VisibilityState>();

export const tableColumnVisibilityPreferences: TableColumnVisibilityPreferenceRepository =
  createTableColumnVisibilityPreferenceRepository();

function createTableColumnVisibilityPreferenceRepository(): TableColumnVisibilityPreferenceRepository {
  return {
    readColumnVisibility(tableId) {
      if (typeof window === "undefined") {
        return inMemoryFallback.get(tableId) ?? {};
      }

      const raw = window.localStorage.getItem(getStorageKey(tableId));
      if (raw === null) {
        return {};
      }

      try {
        const parsed = JSON.parse(raw) as Record<string, boolean> | null;
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    },
    writeColumnVisibility(tableId, visibility) {
      if (typeof window === "undefined") {
        inMemoryFallback.set(tableId, visibility);
        return;
      }

      window.localStorage.setItem(getStorageKey(tableId), JSON.stringify(visibility));
    },
  };
}

function getStorageKey(tableId: string) {
  return `${STORAGE_PREFIX}:${tableId}`;
}
