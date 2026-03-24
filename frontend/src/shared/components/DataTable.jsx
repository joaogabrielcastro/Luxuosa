import { useEffect, useMemo, useState } from "react";

export function DataTable({
  title,
  data,
  columns,
  getRowKey,
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

  useEffect(() => {
    setPage(1);
  }, [search?.query, ...filters.map((item) => item.value)]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      {title ? <h3 className="mb-2 font-semibold">{title}</h3> : null}

      {search || filters.length ? (
        <div className={`mb-3 grid gap-2 ${filters.length ? "md:grid-cols-2" : ""}`}>
          {search ? (
            <input
              className="rounded border p-2 text-sm"
              placeholder={search.placeholder || "Buscar..."}
              value={search.query}
              onChange={(event) => search.onQueryChange(event.target.value)}
            />
          ) : null}
          {filters.map((filter) => (
            <select
              key={filter.id}
              className="rounded border p-2 text-sm"
              value={filter.value}
              onChange={(event) => filter.onChange(event.target.value)}
            >
              {filter.options.map((option) => (
                <option key={`${filter.id}-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b">
              {columns.map((column) => (
                <th key={column.key} className={`py-2 ${column.className || ""}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row) => (
              <tr key={getRowKey(row)} className="border-b">
                {renderCells(row)}
              </tr>
            ))}
            {!paginated.length ? (
              <tr>
                <td className="py-3 text-slate-500" colSpan={columns.length}>
                  {emptyMessage}
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
          <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Proxima
          </button>
        </div>
      </div>
    </div>
  );
}
