import { useEffect, useState } from "react";
import { functionalUpdate, type Updater, type VisibilityState } from "@tanstack/react-table";
import { tableColumnVisibilityPreferences } from "../preferences/table-column-visibility-preferences";

export function useTableColumnVisibilityPreference(tableId: string) {
  const [columnVisibility, setColumnVisibilityState] =
    useState<VisibilityState>(() =>
      tableColumnVisibilityPreferences.readColumnVisibility(tableId),
    );

  useEffect(() => {
    setColumnVisibilityState(
      tableColumnVisibilityPreferences.readColumnVisibility(tableId),
    );
  }, [tableId]);

  function setColumnVisibility(updater: Updater<VisibilityState>) {
    setColumnVisibilityState((current) => {
      const next = functionalUpdate(updater, current);
      tableColumnVisibilityPreferences.writeColumnVisibility(tableId, next);
      return next;
    });
  }

  function showAllColumns() {
    setColumnVisibilityState({});
    tableColumnVisibilityPreferences.writeColumnVisibility(tableId, {});
  }

  return {
    columnVisibility,
    setColumnVisibility,
    showAllColumns,
  };
}
