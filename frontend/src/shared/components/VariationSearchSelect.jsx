import { useId, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./ui/Input.jsx";
import { useVariationSearch } from "../../features/sales/pos/useVariationSearch.js";
import { variationAttributes, variationName } from "../../features/sales/pos/posUtils.js";
import { cn } from "./ui/helpers.js";

/**
 * Escolha de uma variação (produto + tamanho/cor) com busca no servidor.
 * Funciona com qualquer tamanho de catálogo.
 */
export function VariationSearchSelect({ token, value, onChange, label = "Produto", placeholder = "Buscar por nome, código, tamanho ou cor" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const search = useVariationSearch(token, { query, categoryId: "" });
  const options = search.variations.slice(0, 30);

  if (value) {
    const attrs = variationAttributes(value);
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{variationName(value)}</p>
          <p className="truncate text-xs text-slate-500">
            {[attrs, value.sku || value.product?.sku, `estoque atual ${value.stock}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => onChange(null)}
          aria-label="Trocar produto"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input
        className="pl-9"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-pop">
          {search.isLoading ? <li className="px-3 py-2 text-xs text-slate-500">Buscando…</li> : null}
          {!search.isLoading && !options.length ? <li className="px-3 py-2 text-xs text-slate-500">Nada encontrado.</li> : null}
          {options.map((v) => (
            <li key={v.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(v);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-900">{variationName(v)}</span>
                  <span className="block truncate text-xs text-slate-500">{[variationAttributes(v), v.sku || v.product?.sku].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={cn("num shrink-0 text-xs", Number(v.stock) === 0 ? "text-red-600" : "text-slate-500")}>{v.stock} un.</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
