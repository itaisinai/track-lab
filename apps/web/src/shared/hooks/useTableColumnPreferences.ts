import { useEffect, useState } from "react";
import {
  functionalUpdate,
  type ColumnOrderState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import { tableColumnPreferences } from "../preferences/table-column-preferences";

export function useTableColumnPreferences(
  tableId: string,
  defaultColumnOrder: ColumnOrderState,
) {
  const [columnVisibility, setColumnVisibilityState] =
    useState<VisibilityState>(() =>
      tableColumnPreferences.readColumnVisibility(tableId),
    );
  const [columnOrder, setColumnOrderState] = useState<ColumnOrderState>(() =>
    reconcileColumnOrder(
      tableColumnPreferences.readColumnOrder(tableId),
      defaultColumnOrder,
    ),
  );

  useEffect(() => {
    setColumnVisibilityState(
      tableColumnPreferences.readColumnVisibility(tableId),
    );
    setColumnOrderState(
      reconcileColumnOrder(
        tableColumnPreferences.readColumnOrder(tableId),
        defaultColumnOrder,
      ),
    );
  }, [defaultColumnOrder, tableId]);

  function setColumnVisibility(updater: Updater<VisibilityState>) {
    setColumnVisibilityState((current) => {
      const next = functionalUpdate(updater, current);
      tableColumnPreferences.writeColumnVisibility(tableId, next);
      return next;
    });
  }

  function setColumnOrder(updater: Updater<ColumnOrderState>) {
    setColumnOrderState((current) => {
      const next = reconcileColumnOrder(
        functionalUpdate(updater, current),
        defaultColumnOrder,
      );
      tableColumnPreferences.writeColumnOrder(tableId, next);
      return next;
    });
  }

  function showAllColumns() {
    setColumnVisibilityState({});
    tableColumnPreferences.writeColumnVisibility(tableId, {});
  }

  function resetColumns() {
    setColumnVisibilityState({});
    setColumnOrderState(defaultColumnOrder);
    tableColumnPreferences.writeColumnVisibility(tableId, {});
    tableColumnPreferences.writeColumnOrder(tableId, defaultColumnOrder);
  }

  return {
    columnOrder,
    columnVisibility,
    resetColumns,
    setColumnOrder,
    setColumnVisibility,
    showAllColumns,
  };
}

function reconcileColumnOrder(
  persistedOrder: ColumnOrderState,
  defaultColumnOrder: ColumnOrderState,
) {
  const validColumns = new Set(defaultColumnOrder);
  const orderedPersistedColumns = persistedOrder.filter((columnId) =>
    validColumns.has(columnId),
  );
  const missingColumns = defaultColumnOrder.filter(
    (columnId) => !orderedPersistedColumns.includes(columnId),
  );

  return [...orderedPersistedColumns, ...missingColumns];
}
