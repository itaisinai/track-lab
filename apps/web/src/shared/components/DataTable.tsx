import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
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

type DataTableProps<TData> = {
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
  const stableColumns = useMemo(() => columns, [columns]);
  const initialSortingKey = JSON.stringify(initialSorting);

  useEffect(() => {
    setSorting(initialSorting);
  }, [initialSortingKey]);

  const table = useReactTable({
    data,
    columns: stableColumns,
    state: {
      globalFilter,
      expanded,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
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

  return (
    <div className="data-table">
      <div className="table-toolbar">
        <input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
        />
        <span>
          {table.getFilteredRowModel().rows.length} / {data.length}
        </span>
      </div>
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
    </div>
  );
}
