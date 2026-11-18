import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Input } from "./ui/Input.jsx";
import { Select } from "./ui/Select.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";
import { Skeleton } from "./ui/Skeleton.jsx";
import { cn } from "./ui/helpers.js";
import { MOBILE_QUERY, useMediaQuery } from "../hooks/useMediaQuery.js";

function Pager({ from, to, total, page, totalPages, onPrev, onNext, canPrev, canNext }) {
  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span className="num">{total ? `${from}–${to} de ${total}` : "Nenhum resultado"}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm"
          disabled={!canPrev}
          onClick={onPrev}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Anterior
        </button>
        <span className="num min-w-[3.5rem] text-center font-medium text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm"
          disabled={!canNext}
          onClick={onNext}
          aria-label="Próxima página"
        >
          Próxima
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Tabela com busca, filtros e paginação.
 *
 * - Paginação local (padrão) ou no servidor (`serverPagination = { skip, take, total, onChange(skip) }`).
 * - Sem `search.matcher`, a busca não filtra localmente (o servidor já filtrou).
 * - `renderMobileCard(row)`: no celular a lista vira cartões em vez de tabela com rolagem lateral.
 * - `bare`: sem moldura própria (para usar dentro de um SectionCard com `flush`).
 */
export function DataTable({
  title,
  description,
  data,
  columns,
  getRowKey,
  getRowClassName,
  renderCells,
  renderMobileCard,
  onRowClick,
  emptyMessage = "Nenhum registro encontrado.",
  emptyTitle = "Nada por aqui",
  emptyActions = null,
  search,
  filters = [],
  pageSize = 8,
  serverPagination = null,
  loading = false,
  toolbar = null,
  bare = false,
  minWidth = 620
}) {
  const [page, setPage] = useState(1);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const useCards = Boolean(renderMobileCard) && isMobile;

  const filteredData = useMemo(() => {
    let rows = data || [];
    if (search?.query && search?.matcher) {
      rows = rows.filter((row) => search.matcher(row, search.query));
    }
    for (const filter of filters) {
      if (filter.value && filter.matcher && !serverPagination) {
        rows = rows.filter((row) => filter.matcher(row, filter.value));
      }
    }
    return rows;
  }, [data, search, filters, serverPagination]);

  const filterValuesKey = filters.map((f) => f.value).join("|");

  useEffect(() => {
    setPage(1);
  }, [search?.query, filterValuesKey]);

  let paginated;
  let pager;
  if (serverPagination) {
    const { skip, take, total, onChange } = serverPagination;
    paginated = filteredData;
    const totalPages = Math.max(1, Math.ceil((total || 0) / take));
    const current = Math.floor(skip / take) + 1;
    pager = {
      from: total ? skip + 1 : 0,
      to: Math.min(skip + take, total || 0),
      total: total || 0,
      page: current,
      totalPages,
      canPrev: skip > 0,
      canNext: skip + take < (total || 0),
      onPrev: () => onChange(Math.max(0, skip - take)),
      onNext: () => onChange(skip + take)
    };
  } else {
    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    paginated = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    pager = {
      from: filteredData.length ? (currentPage - 1) * pageSize + 1 : 0,
      to: Math.min(currentPage * pageSize, filteredData.length),
      total: filteredData.length,
      page: currentPage,
      totalPages,
      canPrev: currentPage > 1,
      canNext: currentPage < totalPages,
      onPrev: () => setPage((p) => p - 1),
      onNext: () => setPage((p) => p + 1)
    };
  }

  const showToolbar = search || filters.length || toolbar;
  const empty = !loading && !paginated.length;

  return (
    <div className={cn(bare ? "" : "ui-surface overflow-hidden")}>
      {(title || description) && (
        <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
          {title ? <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3> : null}
          {description ? <p className="mt-0.5 text-[13px] text-slate-500">{description}</p> : null}
        </div>
      )}

      {showToolbar ? (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          {search ? (
            <div className="relative min-w-0 flex-1 sm:min-w-[16rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                type="search"
                className="pl-9 pr-9"
                placeholder={search.placeholder || "Buscar…"}
                aria-label={search.placeholder || "Buscar"}
                value={search.query}
                onChange={(event) => search.onQueryChange(event.target.value)}
              />
              {search.query ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => search.onQueryChange("")}
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
          {filters.map((filter) => (
            <Select
              key={filter.id}
              className="sm:w-auto sm:min-w-[11rem]"
              aria-label={filter.label || filter.options?.[0]?.label}
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
          {toolbar}
        </div>
      ) : null}

      {loading && !paginated.length ? (
        <div className="space-y-2 p-4 sm:p-5" role="status" aria-label="Carregando">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : empty ? (
        <div className="p-4 sm:p-5">
          <EmptyState title={emptyTitle} description={emptyMessage} actions={emptyActions} compact />
        </div>
      ) : useCards ? (
        <ul className="divide-y divide-slate-100">
          {paginated.map((row) => (
            <li
              key={getRowKey(row)}
              className={cn("px-4 py-3", onRowClick && "cursor-pointer active:bg-slate-50")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {renderMobileCard(row)}
            </li>
          ))}
        </ul>
      ) : (
        <div className={cn("overflow-x-auto", loading && "opacity-60 transition-opacity")}>
          <table className="w-full text-left text-sm" style={{ minWidth }}>
            <thead>
              <tr className="ui-table-head">
                {columns.map((column, i) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn("px-3 py-2.5", i === 0 && "pl-4 sm:pl-5", i === columns.length - 1 && "pr-4 sm:pr-5", column.className)}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_td:first-child]:pl-4 sm:[&_td:first-child]:pl-5 [&_td:last-child]:pr-4 sm:[&_td:last-child]:pr-5 [&_td]:px-3 [&_td]:py-3">
              {paginated.map((row) => {
                const extra = getRowClassName ? getRowClassName(row) : "";
                return (
                  <tr
                    key={getRowKey(row)}
                    className={cn("ui-table-row", onRowClick && "cursor-pointer", extra)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {renderCells(row)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!empty && (serverPagination || pager.totalPages > 1 || pager.total > 0) ? <Pager {...pager} /> : null}
    </div>
  );
}
