import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "./ui/Input.jsx";
import { Select } from "./ui/Select.jsx";
import { Button } from "./ui/Button.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";

export function DataTable({
  title,
  description,
  data,
  columns,
  getRowKey,
  getRowClassName,
  renderCells,
  emptyMessage = "Nenhum registro encontrado.",
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
  const from = filteredData.length ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(currentPage * pageSize, filteredData.length);

  return (
    <div className="ui-surface overflow-hidden">
      {(title || description) && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 md:px-5">
          {title ? <h3 className="font-semibold text-slate-900">{title}</h3> : null}
          {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
        </div>
      )}

      <div className="p-4 md:p-5">
        {search || filters.length ? (
          <div
            className={`mb-4 grid gap-2 grid-cols-1 ${
              search && filters.length >= 2 ? "md:grid-cols-2 xl:grid-cols-3" : filters.length ? "md:grid-cols-2" : ""
            }`}
          >
            {search ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 text-sm"
                  placeholder={search.placeholder || "Buscar..."}
                  value={search.query}
                  onChange={(event) => search.onQueryChange(event.target.value)}
                />
              </div>
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

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="ui-table-head">
                {columns.map((column) => (
                  <th key={column.key} className={`px-3 py-3 ${column.className || ""}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((row) => {
                const extra = getRowClassName ? getRowClassName(row) : "";
                return (
                  <tr key={getRowKey(row)} className={`ui-table-row ${extra}`.trim()}>
                    {renderCells(row)}
                  </tr>
                );
              })}
              {!paginated.length ? (
                <tr>
                  <td className="p-4" colSpan={columns.length}>
                    <EmptyState title="Nada por aqui" description={emptyMessage} />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            {filteredData.length
              ? `Mostrando ${from}–${to} de ${filteredData.length}`
              : "Nenhum resultado"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="gap-1 px-2.5 py-1.5 text-xs"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Button>
            <span className="min-w-[4.5rem] text-center font-medium text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="secondary"
              className="gap-1 px-2.5 py-1.5 text-xs"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
