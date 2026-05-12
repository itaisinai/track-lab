import {
  Fragment,
  useEffect,
  useMemo,
  useState,
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
  type ColumnDef,
  type ExpandedState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { useTableColumnVisibilityPreference } from "../hooks/useTableColumnVisibilityPreference";
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
  const {
    columnVisibility,
    setColumnVisibility,
    showAllColumns,
  } = useTableColumnVisibilityPreference(tableId);
  const stableColumns = useMemo(() => columns, [columns]);
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
      columnVisibility,
    },
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
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
                    <label
                      className={`table-column-toggle ${
                        column.getCanHide() ? "" : "table-column-toggle-locked"
                      }`}
                      key={column.id}
                    >
                      <span className="table-column-grip" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        disabled={!column.getCanHide()}
                        onChange={column.getToggleVisibilityHandler()}
                      />
                      <span>{getColumnLabel(column.id, column.columnDef.header)}</span>
                    </label>
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
                      showAllColumns();
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
                        <th key={header.id}>
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
            onClick={showAllColumns}
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
