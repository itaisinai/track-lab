import type { ColumnOrderState, VisibilityState } from "@tanstack/react-table";

type TableColumnPreferenceRepository = {
  readColumnVisibility(tableId: string): VisibilityState;
  writeColumnVisibility(tableId: string, visibility: VisibilityState): void;
  readColumnOrder(tableId: string): ColumnOrderState;
  writeColumnOrder(tableId: string, order: ColumnOrderState): void;
};

// Local persistence adapter for now. This stays behind a repository interface
// so a future DB-backed preference store can swap in without touching callers.
const STORAGE_PREFIX = "track-lab.table-columns";

const inMemoryVisibilityFallback = new Map<string, VisibilityState>();
const inMemoryOrderFallback = new Map<string, ColumnOrderState>();

export const tableColumnPreferences: TableColumnPreferenceRepository =
  createTableColumnPreferenceRepository();

function createTableColumnPreferenceRepository(): TableColumnPreferenceRepository {
  return {
    readColumnVisibility(tableId) {
      if (typeof window === "undefined") {
        return inMemoryVisibilityFallback.get(tableId) ?? {};
      }

      return parseVisibility(
        window.localStorage.getItem(getStorageKey(tableId, "visibility")),
      );
    },
    writeColumnVisibility(tableId, visibility) {
      if (typeof window === "undefined") {
        inMemoryVisibilityFallback.set(tableId, visibility);
        return;
      }

      window.localStorage.setItem(
        getStorageKey(tableId, "visibility"),
        JSON.stringify(visibility),
      );
    },
    readColumnOrder(tableId) {
      if (typeof window === "undefined") {
        return inMemoryOrderFallback.get(tableId) ?? [];
      }

      return parseOrder(window.localStorage.getItem(getStorageKey(tableId, "order")));
    },
    writeColumnOrder(tableId, order) {
      if (typeof window === "undefined") {
        inMemoryOrderFallback.set(tableId, order);
        return;
      }

      window.localStorage.setItem(
        getStorageKey(tableId, "order"),
        JSON.stringify(order),
      );
    },
  };
}

function parseVisibility(raw: string | null): VisibilityState {
  if (raw === null) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, boolean> | null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function parseOrder(raw: string | null): ColumnOrderState {
  if (raw === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function getStorageKey(tableId: string, preference: "visibility" | "order") {
  return `${STORAGE_PREFIX}:${tableId}:${preference}`;
}
