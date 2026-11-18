import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { CurrencyInput } from "../../../shared/components/ui/CurrencyInput.jsx";
import { Input } from "../../../shared/components/ui/Input.jsx";
import { Kbd } from "../../../shared/components/ui/Kbd.jsx";
import { SegmentedControl } from "../../../shared/components/ui/SegmentedControl.jsx";
import { cn } from "../../../shared/components/ui/helpers.js";
import { formatCurrencyBRL } from "../../../shared/formatters.js";
import { CustomerPicker } from "./CustomerPicker.jsx";
import {
  ATTENDANT_MAX_DISCOUNT_PERCENT,
  PAYMENT_OPTIONS,
  computeChange,
  lineSubtotal,
  variationAttributes,
  variationName
} from "./posUtils.js";

function Row({ label, value, strong = false, tone = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("text-[13px]", strong ? "font-semibold text-slate-900" : "text-slate-500")}>{label}</dt>
      <dd className={cn("num", strong ? "text-2xl font-semibold tracking-tight text-slate-900" : "text-sm text-slate-700", tone)}>
        {value}
      </dd>
    </div>
  );
}

function CartLine({ line, cart, onNotify }) {
  const v = line.variation;
  const attrs = variationAttributes(v);
  const max = cart.ceiling(v);
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{variationName(v)}</p>
          <p className="truncate text-xs text-slate-500">
            {[attrs, v.sku || v.product?.sku].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <p className="num shrink-0 text-sm font-semibold text-slate-900">{formatCurrencyBRL(lineSubtotal(line))}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30"
            disabled={line.quantity <= 1}
            onClick={() => cart.setQuantity(v.id, line.quantity - 1)}
            aria-label={`Diminuir ${variationName(v)}`}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={line.quantity}
            onChange={(e) => {
              const res = cart.setQuantity(v.id, e.target.value === "" ? 1 : e.target.value);
              if (res?.message) onNotify(res.message, "error");
            }}
            className="num h-9 w-11 border-x border-slate-200 bg-transparent text-center text-sm font-medium focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            aria-label={`Quantidade de ${variationName(v)}`}
          />
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30"
            disabled={line.quantity >= max}
            onClick={() => {
              const res = cart.setQuantity(v.id, line.quantity + 1);
              if (res?.message) onNotify(res.message, "error");
            }}
            aria-label={`Aumentar ${variationName(v)}`}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-xs text-slate-400">un.</span>
          <CurrencyInput
            className="num min-h-9 py-1 text-right sm:min-h-9"
            value={line.unitPrice}
            onChange={(unitPrice) => cart.setUnitPrice(v.id, unitPrice)}
            aria-label={`Preço unitário de ${variationName(v)}`}
          />
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
          onClick={() => cart.removeLine(v.id)}
          aria-label={`Remover ${variationName(v)}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

/**
 * Carrinho, desconto, cliente, pagamento e finalização.
 */
export function CartPanel({ cart, token, userType, enableNfceEmission, submitting, onSubmit, onCancelEdit, onNotify, stacked = false }) {
  const { totals } = cart;
  const isCash = cart.payment.paymentMethod === "CASH";
  const change = computeChange(totals.total, cart.cashReceived);
  const canSubmit = !cart.validationError && !submitting;

  return (
    <div className={cn("flex flex-col", stacked ? "" : "h-full min-h-0")}>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">{cart.editingSale ? "Editando venda" : "Venda atual"}</h2>
          <p className="num text-xs text-slate-500">
            {totals.itemCount} {totals.itemCount === 1 ? "item" : "itens"}
          </p>
        </div>
        {cart.lines.length ? (
          <button
            type="button"
            className="text-xs font-medium text-slate-500 hover:text-red-600"
            onClick={cart.editingSale ? onCancelEdit : cart.reset}
          >
            {cart.editingSale ? "Cancelar edição" : "Limpar"}
          </button>
        ) : null}
      </div>

      <div className={cn("px-4", stacked ? "" : "min-h-0 flex-1 overflow-y-auto overscroll-contain")}>
        {cart.lines.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--neutral-100))] text-slate-400">
              <ShoppingBag className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-700">Carrinho vazio</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-slate-500">
              Bipe a etiqueta ou toque em um produto. <Kbd>F2</Kbd> volta para a busca.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cart.lines.map((line) => (
              <CartLine key={line.variation.id} line={line} cart={cart} onNotify={onNotify} />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3.5 border-t border-slate-200 bg-[rgb(var(--neutral-50))] px-4 pb-4 pt-3.5">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="ui-label mb-0">Desconto</span>
            <SegmentedControl
              size="sm"
              label="Tipo de desconto"
              value={cart.discountMode}
              onChange={cart.setDiscountMode}
              options={[
                { value: "value", label: "R$" },
                { value: "percent", label: "%" }
              ]}
            />
          </div>
          {cart.discountMode === "value" ? (
            <CurrencyInput
              className="num"
              placeholder="0,00"
              value={cart.discountInput}
              onChange={cart.setDiscountInput}
              aria-label="Desconto em reais"
            />
          ) : (
            <Input
              className="num"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              value={cart.discountInput}
              onChange={(e) => cart.setDiscountInput(e.target.value)}
              aria-label="Desconto em porcentagem"
            />
          )}
          {cart.discountError ? (
            <p className="mt-1 text-xs font-medium text-red-600">{cart.discountError}</p>
          ) : userType === "ATTENDANT" ? (
            <p className="mt-1 text-xs text-slate-500">Limite para atendentes: {ATTENDANT_MAX_DISCOUNT_PERCENT}%.</p>
          ) : null}
        </div>

        <div>
          <span className="ui-label">Cliente</span>
          <CustomerPicker token={token} value={cart.customer} onChange={cart.setCustomer} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="ui-label mb-0">Pagamento</span>
            <Link to="/crediario?nova=1" className="text-xs font-medium text-brand-700 hover:underline">
              Fiado? Venda a prazo
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Forma de pagamento">
            {PAYMENT_OPTIONS.map((opt) => {
              const active = cart.payment.paymentMethod === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={cn("ui-chip min-h-11 px-2 text-[13px]", active && "ui-chip-active")}
                  onClick={() =>
                    cart.setPayment((p) => ({
                      ...p,
                      paymentMethod: opt.value,
                      installments: opt.value === "INSTALLMENT" ? Math.max(2, Number(p.installments) || 2) : p.installments
                    }))
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {cart.payment.paymentMethod === "INSTALLMENT" ? (
            <label className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[13px] text-slate-600">Parcelas no cartão</span>
              <Input
                className="num w-24 text-center"
                type="number"
                inputMode="numeric"
                min={2}
                value={cart.payment.installments}
                onChange={(e) => cart.setPayment((p) => ({ ...p, installments: e.target.value }))}
                aria-label="Número de parcelas"
              />
            </label>
          ) : null}
          {isCash ? (
            <div className="mt-2 grid grid-cols-2 items-center gap-2">
              <CurrencyInput
                className="num"
                placeholder="Valor recebido"
                value={cart.cashReceived}
                onChange={cart.setCashReceived}
                aria-label="Valor recebido em dinheiro"
              />
              <p className="num text-right text-sm">
                {change.received ? (
                  change.missing ? (
                    <span className="text-red-600">Faltam {formatCurrencyBRL(change.missing)}</span>
                  ) : (
                    <>
                      <span className="text-slate-500">Troco </span>
                      <strong className="text-emerald-700">{formatCurrencyBRL(change.change)}</strong>
                    </>
                  )
                ) : (
                  <span className="text-xs text-slate-400">Informe para calcular o troco</span>
                )}
              </p>
            </div>
          ) : null}
        </div>

        {!cart.editingSale && enableNfceEmission ? (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
            <span className="text-[13px] text-slate-700">Emitir NFC-e ao finalizar</span>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
              checked={Boolean(cart.emitNfce)}
              onChange={(e) => cart.setEmitNfce(e.target.checked)}
            />
          </label>
        ) : null}

        <div className={cn("space-y-3.5", stacked && "sticky bottom-0 -mx-4 -mb-4 border-t border-slate-200 bg-[rgb(var(--neutral-50))] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3")}>
        <dl className={cn("space-y-1", !stacked && "border-t border-dashed border-slate-200 pt-3")}>
          <Row label="Subtotal" value={formatCurrencyBRL(totals.gross)} />
          {totals.discountAmount > 0 ? (
            <Row
              label={`Desconto${totals.effectivePercent ? ` (${totals.effectivePercent.toFixed(1).replace(".", ",")}%)` : ""}`}
              value={`− ${formatCurrencyBRL(totals.discountAmount)}`}
              tone="text-emerald-700"
            />
          ) : null}
          <Row label="Total" value={formatCurrencyBRL(totals.total)} strong />
        </dl>

        <Button
          size="lg"
          className="w-full text-base"
          disabled={!canSubmit}
          loading={submitting}
          onClick={onSubmit}
          title={cart.validationError || undefined}
        >
          {cart.editingSale ? "Salvar alterações" : "Finalizar venda"}
          {!submitting ? (
            <span className="ml-1 hidden items-center gap-0.5 opacity-70 lg:inline-flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>↵</Kbd>
            </span>
          ) : null}
        </Button>
        {cart.lines.length && cart.validationError && !cart.discountError ? (
          <p className="-mt-2 text-center text-xs text-red-600">{cart.validationError}</p>
        ) : null}
        </div>
      </div>
    </div>
  );
}
