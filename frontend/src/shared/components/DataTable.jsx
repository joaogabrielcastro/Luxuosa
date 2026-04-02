import { useEffect, useMemo, useState } from "react";
import { Input } from "./ui/Input.jsx";
import { Select } from "./ui/Select.jsx";
import { Button } from "./ui/Button.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";

export function DataTable({
  title,
  data,
  columns,
  getRowKey,
  getRowClassName,
  renderCells,
  emptyMessage = "Sem registros.",
  search,
  filters = [],
  pageSize = 8
}) {
  const [page, setPage] = useState(1);

  const filteredData = useMemo(() => {
    let rows = data;

    if (search?.query && search?.matcher) {
      rows = rows.filter((row) => search.matcher(row, search.query));
    }

    for (const filter of filters) {
      if (filter.value) {
        rows = rows.filter((row) => filter.matcher(row, filter.value));
      }
    }

    return rows;
  }, [data, search, filters]);

  const filterValuesKey = filters.map((f) => f.value).join("|");

  useEffect(() => {
    setPage(1);
  }, [search?.query, filterValuesKey]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="ui-surface p-4">
      {title ? <h3 className="mb-3 font-semibold">{title}</h3> : null}

      {search || filters.length ? (
        <div
          className={`mb-3 grid gap-2 grid-cols-1 ${
            search && filters.length >= 2 ? "md:grid-cols-2 xl:grid-cols-3" : filters.length ? "md:grid-cols-2" : ""
          }`}
        >
          {search ? (
            <Input
              className="text-sm"
              placeholder={search.placeholder || "Buscar..."}
              value={search.query}
              onChange={(event) => search.onQueryChange(event.target.value)}
            />
          ) : null}
          {filters.map((filter) => (
            <Select
              key={filter.id}
              className="text-sm"
              value={filter.value}
              onChange={(event) => filter.onChange(event.target.value)}
            >
              {filter.options.map((option) => (
                <option key={`${filter.id}-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              {columns.map((column) => (
                <th key={column.key} className={`py-2.5 ${column.className || ""}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row) => {
              const extra = getRowClassName ? getRowClassName(row) : "";
              return (
                <tr
                  key={getRowKey(row)}
                  className={`border-b border-slate-100 hover:bg-slate-50 ${extra}`.trim()}
                >
                  {renderCells(row)}
                </tr>
              );
            })}
            {!paginated.length ? (
              <tr>
                <td className="py-5 text-slate-500" colSpan={columns.length}>
                  <EmptyState title="Nada para mostrar" description={emptyMessage} />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
        <span>
          Pagina {currentPage} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Proxima
          </Button>
        </div>
      </div>
    </div>
  );
}
