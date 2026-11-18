import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserRound, X } from "lucide-react";
import { apiClient } from "../../../shared/apiClient.js";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue.js";
import { Input } from "../../../shared/components/ui/Input.jsx";

function docLabel(c) {
  const d = String(c?.cpfCnpj || "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return c?.cpfCnpj || c?.phone || c?.email || "";
}

/** Seleção de cliente com busca no servidor. Sem cliente = consumidor final. */
export function CustomerPicker({ token, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 220);
  const listId = useId();

  const q = useQuery({
    queryKey: ["customers", token, "pos-picker", debounced.trim()],
    enabled: Boolean(token) && open,
    staleTime: 30_000,
    queryFn: () => {
      const term = debounced.trim();
      return apiClient(`/customers?take=8&skip=0${term ? `&q=${encodeURIComponent(term)}` : ""}`, { token });
    }
  });

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{value.name}</p>
          {docLabel(value) ? <p className="truncate text-xs text-slate-500">{docLabel(value)}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Remover cliente"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  const items = q.data?.items ?? [];

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input
        className="pl-9"
        placeholder="Consumidor final — buscar cliente"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Buscar cliente"
        autoComplete="off"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 bottom-full z-20 mb-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-pop md:bottom-auto md:top-full md:mb-0 md:mt-1"
        >
          {q.isLoading ? <li className="px-3 py-2 text-xs text-slate-500">Buscando…</li> : null}
          {!q.isLoading && !items.length ? (
            <li className="px-3 py-2 text-xs text-slate-500">Nenhum cliente encontrado.</li>
          ) : null}
          {items.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ id: c.id, name: c.name, cpfCnpj: c.cpfCnpj });
                  setOpen(false);
                }}
              >
                <span className="truncate text-sm text-slate-900">{c.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{docLabel(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
