import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnOrderState,
  type ExpandedState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { useTableColumnPreferences } from "../hooks/useTableColumnPreferences";
import { ColumnsIcon } from "../icons/ColumnsIcon";
import { XIcon } from "../icons/XIcon";

type DataTableProps<TData> = {
  tableId: string;
  data: TData[];
  columns: ColumnDef<TData>[];
  emptyMessage: string;
  getRowKey: (row: TData) => string | number;
  searchPlaceholder?: string;
  minWidth?: number;
  initialSorting?: SortingState;
  getRowCanExpand?: (row: TData) => boolean;
  renderExpandedRow?: (row: TData) => ReactNode;
};

export function DataTable<TData>({
  tableId,
  data,
  columns,
  emptyMessage,
  getRowKey,
  searchPlaceholder = "Search table",
  minWidth = 1160,
  initialSorting = [],
  getRowCanExpand,
  renderExpandedRow,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [isColumnsDrawerOpen, setIsColumnsDrawerOpen] = useState(false);
  const [columnsSearch, setColumnsSearch] = useState("");
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const stableColumns = useMemo(() => columns, [columns]);
  const defaultColumnOrder = useMemo(
    () => getDefaultColumnOrder(stableColumns),
    [stableColumns],
  );
  const {
    columnOrder,
    columnVisibility,
    resetColumns,
    setColumnOrder,
    setColumnVisibility,
  } = useTableColumnPreferences(tableId, defaultColumnOrder);
  const initialSortingKey = JSON.stringify(initialSorting);

  useEffect(() => {
    setSorting(initialSorting);
  }, [initialSortingKey]);

  useEffect(() => {
    if (!isColumnsDrawerOpen) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsColumnsDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isColumnsDrawerOpen]);

  const table = useReactTable({
    data,
    columns: stableColumns,
    state: {
      globalFilter,
      expanded,
      sorting,
      columnOrder,
      columnVisibility,
    },
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: getRowCanExpand
      ? (row: Row<TData>) => getRowCanExpand(row.original)
      : undefined,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const totalColumnCount = table.getAllLeafColumns().length;
  const hasVisibleColumns = visibleColumnCount > 0;
  const columnQuery = columnsSearch.trim().toLowerCase();
  const leafColumns = table.getAllLeafColumns();
  const columnsForPicker = columnQuery
    ? leafColumns.filter((column) =>
        getColumnSearchText(column).includes(columnQuery),
      )
    : leafColumns;

  function handleColumnDragStart(
    event: DragEvent<HTMLElement>,
    columnId: string,
  ) {
    setDraggingColumnId(columnId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnId);
  }

  function handleColumnDragOver(
    event: DragEvent<HTMLElement>,
    columnId: string,
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverColumnId(columnId);
  }

  function handleColumnDrop(
    event: DragEvent<HTMLElement>,
    targetColumnId: string,
  ) {
    event.preventDefault();
    const sourceColumnId =
      draggingColumnId || event.dataTransfer.getData("text/plain");

    if (!sourceColumnId || sourceColumnId === targetColumnId) {
      clearColumnDragState();
      return;
    }

    setColumnOrder((current) =>
      moveColumnToTarget(current, sourceColumnId, targetColumnId),
    );
    clearColumnDragState();
  }

  function clearColumnDragState() {
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  }

  return (
    <div className="data-table">
      <div className="table-toolbar">
        <input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
        />
        <div className="table-toolbar-actions">
          <span>
            {table.getFilteredRowModel().rows.length} / {data.length}
          </span>
          <div className="table-columns-popover">
            <button
              className="secondary compact table-columns-trigger"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isColumnsDrawerOpen}
              onClick={() => setIsColumnsDrawerOpen((current) => !current)}
            >
              <ColumnsIcon className="button-icon" />
              <span>Columns</span>
              <span className="table-columns-trigger-count">
                {visibleColumnCount}/{totalColumnCount}
              </span>
            </button>
            {isColumnsDrawerOpen && (
              <aside
                className="table-columns-drawer"
                role="dialog"
                aria-label="Customize columns"
              >
                <div className="table-columns-drawer-header">
                  <div>
                    <h3>Customize columns</h3>
                    <p>Show or hide table columns</p>
                  </div>
                  <button
                    className="icon-button secondary"
                    type="button"
                    onClick={() => setIsColumnsDrawerOpen(false)}
                    aria-label="Close columns panel"
                  >
                    <XIcon className="button-icon" />
                  </button>
                </div>
                <label className="table-columns-search">
                  <span className="sr-only">Search columns</span>
                  <input
                    value={columnsSearch}
                    onChange={(event) => setColumnsSearch(event.target.value)}
                    placeholder="Search columns..."
                    type="search"
                  />
                </label>
                <div className="table-columns-drawer-list">
                  {columnsForPicker.map((column) => (
                    <div
                      className={getColumnDragClassName(
                        "table-column-toggle",
                        column.id,
                        draggingColumnId,
                        dragOverColumnId,
                        column.getCanHide(),
                      )}
                      key={column.id}
                      draggable
                      onDragStart={(event) =>
                        handleColumnDragStart(event, column.id)
                      }
                      onDragOver={(event) =>
                        handleColumnDragOver(event, column.id)
                      }
                      onDrop={(event) => handleColumnDrop(event, column.id)}
                      onDragEnd={clearColumnDragState}
                    >
                      <span className="table-column-grip" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                      <label className="table-column-toggle-label">
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          disabled={!column.getCanHide()}
                          onChange={column.getToggleVisibilityHandler()}
                        />
                        <span>{getColumnLabel(column.id, column.columnDef.header)}</span>
                      </label>
                      <div className="table-column-move-actions">
                        <button
                          className="secondary compact table-column-move-button"
                          type="button"
                          aria-label={`Move ${getColumnLabel(column.id, column.columnDef.header)} left`}
                          disabled={!canMoveColumn(column, leafColumns, "left")}
                          onClick={() =>
                            setColumnOrder((current) =>
                              moveColumn(current, column.id, "left"),
                            )
                          }
                        >
                          <span aria-hidden="true">←</span>
                        </button>
                        <button
                          className="secondary compact table-column-move-button"
                          type="button"
                          aria-label={`Move ${getColumnLabel(column.id, column.columnDef.header)} right`}
                          disabled={!canMoveColumn(column, leafColumns, "right")}
                          onClick={() =>
                            setColumnOrder((current) =>
                              moveColumn(current, column.id, "right"),
                            )
                          }
                        >
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {columnsForPicker.length === 0 && (
                    <div className="table-columns-empty-state">
                      No columns match your search.
                    </div>
                  )}
                </div>
                <div className="table-columns-drawer-footer">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      resetColumns();
                      setColumnsSearch("");
                    }}
                  >
                    Reset to default
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsColumnsDrawerOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
      {hasVisibleColumns ? (
        <>
          <div className="table-wrap">
            <table style={{ minWidth }}>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDirection = header.column.getIsSorted();

                      return (
                        <th
                          className={getColumnDragClassName(
                            "table-header-cell",
                            header.column.id,
                            draggingColumnId,
                            dragOverColumnId,
                          )}
                          key={header.id}
                          draggable={!header.isPlaceholder}
                          onDragStart={(event) =>
                            handleColumnDragStart(event, header.column.id)
                          }
                          onDragOver={(event) =>
                            handleColumnDragOver(event, header.column.id)
                          }
                          onDrop={(event) =>
                            handleColumnDrop(event, header.column.id)
                          }
                          onDragEnd={clearColumnDragState}
                        >
                          {header.isPlaceholder ? null : (
                            canSort ? (
                              <button
                                className="table-sort"
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                <span>
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  ) as ReactNode}
                                </span>
                                {sortDirection && (
                                  <span aria-hidden="true">
                                    {sortDirection === "asc" ? "↑" : "↓"}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <span className="table-sort-label">
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                ) as ReactNode}
                              </span>
                            )
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <Fragment key={getRowKey(row.original)}>
                    <tr>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {
                            flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            ) as ReactNode
                          }
                        </td>
                      ))}
                    </tr>
                    {row.getIsExpanded() && renderExpandedRow && (
                      <tr>
                        <td colSpan={visibleColumnCount}>
                          {renderExpandedRow(row.original)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumnCount}>{emptyMessage}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <button
              className="secondary compact"
              type="button"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </button>
            <span>
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {Math.max(table.getPageCount(), 1)}
            </span>
            <button
              className="secondary compact"
              type="button"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="table-columns-empty">
          <strong>All columns hidden</strong>
          <span>Use the Columns menu to restore visibility.</span>
          <button
            className="secondary compact"
            type="button"
            onClick={resetColumns}
          >
            Show all columns
          </button>
        </div>
      )}
    </div>
  );
}

function getColumnLabel(
  columnId: string,
  header: unknown,
) {
  if (typeof header === "string" && header.trim().length > 0) {
    return header;
  }

  if (typeof header === "number") {
    return String(header);
  }

  return columnId;
}

function getColumnSearchText(column: {
  id: string;
  columnDef: { header?: unknown };
}) {
  return `${column.id} ${getColumnLabel(column.id, column.columnDef.header)}`
    .toLowerCase()
    .trim();
}

function getDefaultColumnOrder<TData>(
  columns: ColumnDef<TData>[],
): ColumnOrderState {
  return columns
    .map((column, index) => getColumnDefId(column, index))
    .filter((columnId): columnId is string => Boolean(columnId));
}

function getColumnDefId<TData>(
  column: ColumnDef<TData>,
  index: number,
) {
  const columnRecord = column as unknown as Record<string, unknown>;
  const explicitId = columnRecord.id;
  const accessorKey = columnRecord.accessorKey;

  if (typeof explicitId === "string" && explicitId.length > 0) {
    return explicitId;
  }

  if (
    (typeof accessorKey === "string" || typeof accessorKey === "number") &&
    String(accessorKey).length > 0
  ) {
    return String(accessorKey).replaceAll(".", "_");
  }

  return `column-${index}`;
}

function canMoveColumn<TData>(
  column: Column<TData, unknown>,
  columns: Array<Column<TData, unknown>>,
  direction: "left" | "right",
) {
  const index = columns.findIndex((candidate) => candidate.id === column.id);

  return direction === "left"
    ? index > 0
    : index >= 0 && index < columns.length - 1;
}

function moveColumn(
  currentOrder: ColumnOrderState,
  columnId: string,
  direction: "left" | "right",
): ColumnOrderState {
  const index = currentOrder.indexOf(columnId);

  if (index < 0) {
    return currentOrder;
  }

  const targetIndex = direction === "left" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= currentOrder.length) {
    return currentOrder;
  }

  const nextOrder = [...currentOrder];
  [nextOrder[index], nextOrder[targetIndex]] = [
    nextOrder[targetIndex],
    nextOrder[index],
  ];

  return nextOrder;
}

function moveColumnToTarget(
  currentOrder: ColumnOrderState,
  sourceColumnId: string,
  targetColumnId: string,
): ColumnOrderState {
  const sourceIndex = currentOrder.indexOf(sourceColumnId);
  const targetIndex = currentOrder.indexOf(targetColumnId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return currentOrder;
  }

  const nextOrder = [...currentOrder];
  const [sourceColumn] = nextOrder.splice(sourceIndex, 1);
  const adjustedTargetIndex = sourceIndex < targetIndex
    ? targetIndex - 1
    : targetIndex;

  nextOrder.splice(adjustedTargetIndex, 0, sourceColumn);
  return nextOrder;
}

function getColumnDragClassName(
  baseClassName: string,
  columnId: string,
  draggingColumnId: string | null,
  dragOverColumnId: string | null,
  canHide = true,
) {
  return [
    baseClassName,
    canHide ? "" : "table-column-toggle-locked",
    draggingColumnId === columnId ? "is-dragging" : "",
    dragOverColumnId === columnId && draggingColumnId !== columnId
      ? "is-drag-over"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
