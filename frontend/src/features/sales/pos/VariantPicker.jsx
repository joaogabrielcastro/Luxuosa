import { Check } from "lucide-react";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { formatCurrencyBRL } from "../../../shared/formatters.js";
import { cn } from "../../../shared/components/ui/helpers.js";
import { buildGrid } from "./posUtils.js";

/**
 * Grade tamanho × cor com estoque. Toque na célula para incluir no carrinho.
 * Em grades de uma dimensão (só tamanho ou só cor) mostra botões grandes.
 */
export function VariantPicker({ group, onClose, onPick, ceiling, quantityInCart }) {
  if (!group) return null;
  const grid = buildGrid(group.variations);
  const product = group.product || {};
  const oneDimension = grid.colors.length === 1 || grid.sizes.length === 1;

  function cellState(v) {
    if (!v) return { available: 0, inCart: 0, disabled: true };
    const inCart = quantityInCart(v.id);
    const available = Math.max(0, ceiling(v) - inCart);
    return { available, inCart, disabled: available < 1 };
  }

  function renderCell(v, label) {
    const { available, inCart, disabled } = cellState(v);
    return (
      <button
        key={v?.id || label}
        type="button"
        disabled={disabled}
        onClick={() => onPick(v)}
        className={cn(
          "relative flex min-h-14 w-full min-w-[3.5rem] flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition-colors",
          disabled
            ? "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-400"
            : "border-slate-200 bg-white text-slate-900 hover:border-brand-400 hover:bg-brand-50 active:bg-brand-100",
          inCart ? "ring-2 ring-brand-500" : ""
        )}
        aria-label={`${label}${v ? `, ${available} disponível` : ", indisponível"}`}
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className="num text-2xs text-slate-500">{v ? `${available} disp.` : "—"}</span>
        {inCart ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1 text-2xs font-semibold text-white">
            {inCart}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <Modal
      open
      size="lg"
      title={product.name}
      description={`${[product.brand?.name, product.sku ? `SKU ${product.sku}` : null].filter(Boolean).join(" · ")} — ${formatCurrencyBRL(product.price)}`}
      onClose={onClose}
      closeText="Concluir"
    >
      <p className="mb-3 text-[13px] text-slate-500">Toque no tamanho e cor para adicionar. Toque de novo para somar mais uma unidade.</p>
      {oneDimension ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {grid.sizes.flatMap((size) =>
            grid.colors.map((color) => {
              const v = grid.get(size, color);
              const label = [size, color].filter(Boolean).join(" · ") || "Único";
              return v ? renderCell(v, label) : null;
            })
          )}
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <table className="w-full border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th className="w-24" />
                {grid.sizes.map((size) => (
                  <th key={size} scope="col" className="text-xs font-semibold text-slate-500">
                    {size || "—"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.colors.map((color) => (
                <tr key={color}>
                  <th scope="row" className="pr-1 text-left text-[13px] font-medium text-slate-700">
                    {color || "—"}
                  </th>
                  {grid.sizes.map((size) => {
                    const v = grid.get(size, color);
                    return <td key={size}>{renderCell(v, size || "—")}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> O contorno indica o que já está no carrinho.
      </p>
    </Modal>
  );
}
