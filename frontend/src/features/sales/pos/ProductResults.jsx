import { memo } from "react";
import { PackageX, Plus } from "lucide-react";
import { formatCurrencyBRL } from "../../../shared/formatters.js";
import { cn } from "../../../shared/components/ui/helpers.js";
import { compareSizes } from "./posUtils.js";

function initialsOf(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const ProductCard = memo(function ProductCard({ group, onSelect, inCartCount }) {
  const product = group.product || {};
  const out = group.totalStock < 1;
  const sizes = group.hasGrid
    ? [...new Set(group.variations.filter((v) => Number(v.stock) > 0).map((v) => String(v.size || "").trim()).filter(Boolean))].sort(compareSizes)
    : [];
  return (
    <button
      type="button"
      onClick={() => onSelect(group)}
      disabled={out}
      className={cn(
        "group relative flex h-full flex-col rounded-xl border bg-white p-3 text-left shadow-card transition-[border-color,box-shadow] duration-150",
        out ? "cursor-not-allowed border-slate-200 opacity-60" : "border-slate-200/80 hover:border-brand-300 hover:shadow-card-hover active:scale-[0.99]",
        inCartCount ? "ring-2 ring-brand-500/70" : ""
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--neutral-100))] font-display text-lg text-brand-800">
          {initialsOf(product.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{product.name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {[product.brand?.name, product.sku].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="num text-base font-semibold text-slate-900">{formatCurrencyBRL(product.price)}</p>
          <p className={cn("num text-xs", out ? "text-red-600" : "text-slate-500")}>
            {out ? "Sem estoque" : `${group.totalStock} em estoque`}
          </p>
        </div>
        {!out ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
            <Plus className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      {sizes.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {sizes.slice(0, 8).map((s) => (
            <span key={s} className="rounded border border-slate-200 px-1.5 py-0.5 text-2xs font-medium text-slate-600">
              {s}
            </span>
          ))}
          {sizes.length > 8 ? <span className="text-2xs text-slate-400">+{sizes.length - 8}</span> : null}
        </div>
      ) : null}
      {inCartCount ? (
        <span className="num absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-700 px-1.5 text-xs font-semibold text-white shadow">
          {inCartCount}
        </span>
      ) : null}
    </button>
  );
});

export function ProductResults({ groups, onSelect, cartCountByProduct, loading, query }) {
  if (loading && !groups.length) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Carregando produtos">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="ui-skeleton h-32 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!groups.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
        <PackageX className="h-8 w-8 text-slate-300" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-slate-800">
          {query ? `Nada encontrado para “${query}”` : "Nenhum produto nesta seleção"}
        </p>
        <p className="mt-1 max-w-xs text-[13px] text-slate-500">
          Busque por nome, código da etiqueta, tamanho ou cor — por exemplo “vestido M preto”.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {groups.map((g) => (
        <ProductCard key={g.productId} group={g} onSelect={onSelect} inCartCount={cartCountByProduct.get(g.productId) || 0} />
      ))}
    </div>
  );
}
