import { useEffect, useMemo, useState } from "react";
import { brandIdsForCategory, variationsForCategoryAndBrand } from "../sales.utils.js";
import { SectionCard } from "../../../shared/components/ui/SectionCard.jsx";
import { Alert } from "../../../shared/components/ui/Alert.jsx";
import { Input } from "../../../shared/components/ui/Input.jsx";
import { Select } from "../../../shared/components/ui/Select.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { formatCurrencyBRL, parseCurrencyInput } from "../../../shared/formatters.js";
import { useToast } from "../../../shared/components/ToastProvider.jsx";

function parseQty(raw) {
  if (raw === "" || raw === undefined) return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function variationLabel(v) {
  if (!v) return "—";
  return `${v.product?.name || "Produto"} · ${v.size}/${v.color}`;
}

export function SalesFormCard({
  editingSaleId,
  form,
  setForm,
  createSale,
  error,
  items,
  sortedBrands,
  sortedCategories,
  variations,
  updateItem,
  removeItem,
  addItemByBarcode,
  addItemByVariationId,
  addManualLine,
  loading,
  cancelEdit,
  /** Só a loja com emitente na Nuvem Fiscal (ex.: Luxuosa demo) pode enfileirar NFC-e. */
  enableNfceEmission = false,
  /** (id) => quantidade ainda vendivel para a variacao; se omitido, nao filtra a busca rapida. */
  getRemainingUnits = null
}) {
  const { showToast } = useToast();

  useEffect(() => {
    if (!enableNfceEmission) {
      setForm((prev) => ({ ...prev, emitNfce: false }));
    }
  }, [enableNfceEmission, setForm]);
  const [unifiedInput, setUnifiedInput] = useState("");
  const [manualDraft, setManualDraft] = useState({
    categoryId: "",
    brandId: "",
    productVariationId: "",
    quantity: "1"
  });

  const saleTotals = useMemo(() => {
    let gross = 0;
    for (const item of items) {
      const qty = parseQty(item.quantity);
      const unit = parseCurrencyInput(item.unitPrice);
      if (Number.isFinite(qty) && qty >= 1 && unit > 0) {
        gross += qty * unit;
      }
    }
    const dv = form.discountValue === "" ? 0 : Number(form.discountValue);
    const dp = form.discountPercent === "" ? 0 : Number(form.discountPercent);
    const discountFromPercent = Number.isFinite(dp) && dp > 0 ? (gross * dp) / 100 : 0;
    const discountFromValue = Number.isFinite(dv) && dv > 0 ? dv : 0;
    const total = Math.max(gross - discountFromValue - discountFromPercent, 0);
    return {
      gross,
      discountFromValue,
      discountFromPercent,
      total
    };
  }, [items, form.discountValue, form.discountPercent]);

  const quickOptions = useMemo(() => {
    const q = unifiedInput.trim().toLowerCase();
    if (!q) return [];
    return variations
      .filter((v) => {
        if (getRemainingUnits && getRemainingUnits(v.id) < 1) return false;
        const name = String(v.product?.name || "").toLowerCase();
        const sku = String(v.product?.sku || "").toLowerCase();
        const size = String(v.size || "").toLowerCase();
        const color = String(v.color || "").toLowerCase();
        return `${name} ${sku} ${size} ${color}`.includes(q);
      })
      .slice(0, 8);
  }, [unifiedInput, variations, getRemainingUnits]);

  function handleUnifiedEnter() {
    const raw = unifiedInput.trim();
    if (!raw) return;

    const skuHits = variations.filter((v) => String(v.product?.sku || "").trim() === raw);
    if (skuHits.length) {
      addItemByBarcode(raw);
      setUnifiedInput("");
      return;
    }

    const opts = quickOptions;
    if (opts.length === 1) {
      addItemByVariationId(opts[0].id);
      setUnifiedInput("");
      return;
    }
    if (opts.length > 1) {
      showToast("Varios resultados: toque em um item da lista abaixo.", "error");
      return;
    }
    showToast("Nenhum produto encontrado. Confira o SKU ou busque na lista.", "error");
  }

  const brandsInManual = brandIdsForCategory(variations, manualDraft.categoryId);
  const brandOptionsManual = sortedBrands.filter((b) => brandsInManual.has(b.id));
  const filteredManual = variationsForCategoryAndBrand(
    variations,
    manualDraft.categoryId,
    manualDraft.brandId
  );

  function submitManual() {
    addManualLine(manualDraft);
    setManualDraft((d) => ({
      ...d,
      productVariationId: "",
      quantity: "1"
    }));
  }

  const variationById = useMemo(() => new Map(variations.map((v) => [v.id, v])), [variations]);

  return (
    <SectionCard title={editingSaleId ? "Editar venda" : "Nova venda"}>
      <form className="mt-4 space-y-8" onSubmit={createSale}>
        {/* 1 — Adicionar produtos */}
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">1. Adicionar produtos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Um unico campo: digite para buscar ou use o leitor de codigo de barras / SKU (Enter confirma).
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="sale-unified-search">
              Buscar produto ou bipar codigo
            </label>
            <Input
              id="sale-unified-search"
              className="text-base md:text-lg"
              placeholder="Nome, SKU, tamanho, cor — ou bip do codigo de barras"
              value={unifiedInput}
              onChange={(e) => setUnifiedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleUnifiedEnter();
                }
              }}
              autoComplete="off"
            />
            {quickOptions.length ? (
              <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {quickOptions.map((variation) => (
                  <button
                    key={variation.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50"
                    onClick={() => {
                      addItemByVariationId(variation.id);
                      setUnifiedInput("");
                    }}
                  >
                    <span className="min-w-0 truncate">{variationLabel(variation)}</span>
                    <span className="shrink-0 text-xs text-slate-500">SKU {variation.product?.sku}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium text-slate-700">Ou escolha pelo catalogo</p>
            <p className="mt-0.5 text-xs text-slate-500">Categoria, marca, produto e quantidade — depois incluir na lista.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Categoria</span>
                <Select
                  value={manualDraft.categoryId}
                  onChange={(e) =>
                    setManualDraft((d) => ({
                      ...d,
                      categoryId: e.target.value,
                      brandId: "",
                      productVariationId: ""
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {sortedCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Marca</span>
                <Select
                  disabled={!manualDraft.categoryId}
                  value={manualDraft.brandId}
                  onChange={(e) =>
                    setManualDraft((d) => ({
                      ...d,
                      brandId: e.target.value,
                      productVariationId: ""
                    }))
                  }
                >
                  <option value="">{!manualDraft.categoryId ? "—" : "Selecione"}</option>
                  {brandOptionsManual.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 md:col-span-2 lg:col-span-1">
                <span className="text-xs font-medium text-slate-600">Produto (variacao)</span>
                <Select
                  disabled={!manualDraft.categoryId || !manualDraft.brandId}
                  value={manualDraft.productVariationId}
                  onChange={(e) => setManualDraft((d) => ({ ...d, productVariationId: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  {filteredManual.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.product?.name} — {v.size}/{v.color} (estq. {v.stock})
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Quantidade</span>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={manualDraft.quantity}
                  onChange={(e) => setManualDraft((d) => ({ ...d, quantity: e.target.value }))}
                />
              </label>
            </div>
            <Button type="button" variant="secondary" className="mt-3 text-sm" onClick={submitManual}>
              Incluir na lista
            </Button>
          </div>
        </section>

        {/* 2 — Itens da venda */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">2. Itens da venda</h3>
          {items.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-6 text-center text-sm text-amber-900">
              Nenhum produto na lista. Use o campo acima ou o catalogo.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Produto</th>
                    <th className="w-24 px-2 py-2">Qtd</th>
                    <th className="w-32 px-2 py-2">Preco unit.</th>
                    <th className="w-28 px-2 py-2">Subtotal</th>
                    <th className="w-24 px-2 py-2 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const v = variationById.get(item.productVariationId);
                    const qty = parseQty(item.quantity);
                    const unit = parseCurrencyInput(item.unitPrice);
                    const sub =
                      Number.isFinite(qty) && qty >= 1 && unit > 0 ? formatCurrencyBRL(qty * unit) : "—";
                    return (
                      <tr key={`${item.productVariationId}-${index}`} className="border-b border-slate-100">
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-900">{variationLabel(v)}</div>
                          <div className="text-xs text-slate-500">SKU {v?.product?.sku ?? "—"}</div>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <Input
                            className="text-sm"
                            type="number"
                            min={1}
                            step={1}
                            max={
                              v && getRemainingUnits
                                ? getRemainingUnits(v.id, index) + parseQty(item.quantity)
                                : undefined
                            }
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <Input
                            className="text-sm"
                            inputMode="decimal"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2 align-top font-medium text-slate-800">{sub}</td>
                        <td className="px-2 py-2 text-right align-top">
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(index)}
                          >
                            Remover
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3 — Desconto */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">3. Desconto (opcional)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Desconto em reais (R$)</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex.: 10,00"
                value={form.discountValue}
                onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Desconto em porcentagem (%)</span>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Ex.: 5"
                value={form.discountPercent}
                onChange={(e) => setForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
              />
            </label>
          </div>
        </section>

        {/* 4 — Resumo */}
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
          <h3 className="text-sm font-semibold text-slate-900">4. Resumo da venda</h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Subtotal (itens)</dt>
              <dd className="font-medium text-slate-900">{formatCurrencyBRL(saleTotals.gross)}</dd>
            </div>
            {saleTotals.discountFromValue > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Desconto em R$</dt>
                <dd className="text-emerald-800">− {formatCurrencyBRL(saleTotals.discountFromValue)}</dd>
              </div>
            ) : null}
            {saleTotals.discountFromPercent > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Desconto percentual</dt>
                <dd className="text-emerald-800">− {formatCurrencyBRL(saleTotals.discountFromPercent)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-indigo-200 pt-2">
              <dt className="text-base font-semibold text-slate-800">Total</dt>
              <dd className="text-base font-bold text-indigo-900">{formatCurrencyBRL(saleTotals.total)}</dd>
            </div>
          </dl>
        </div>

        {/* 5 — Pagamento */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">5. Pagamento</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:max-w-xs">
              <span className="text-xs font-medium text-slate-600">Forma de pagamento</span>
              <Select
                value={form.paymentMethod}
                onChange={(e) => {
                  const paymentMethod = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    paymentMethod,
                    installments: paymentMethod === "INSTALLMENT" ? Math.max(2, Number(prev.installments) || 2) : 1
                  }));
                }}
              >
                <option value="PIX">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="CREDIT_CARD">Cartao credito</option>
                <option value="DEBIT_CARD">Cartao debito</option>
                <option value="INSTALLMENT">Parcelado</option>
              </Select>
            </label>
            {form.paymentMethod === "INSTALLMENT" ? (
              <label className="flex max-w-xs flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Numero de parcelas</span>
                <Input
                  type="number"
                  min={2}
                  placeholder="Ex.: 3"
                  value={form.installments}
                  onChange={(e) => setForm((prev) => ({ ...prev, installments: e.target.value }))}
                />
                <span className="text-xs text-slate-500">Minimo 2 parcelas.</span>
              </label>
            ) : null}
          </div>

          {!editingSaleId && enableNfceEmission ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={Boolean(form.emitNfce)}
                onChange={(e) => setForm((prev) => ({ ...prev, emitNfce: e.target.checked }))}
              />
              <span>
                <span className="text-sm font-medium text-slate-800">Emitir NFC-e apos finalizar</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Desmarque para registrar apenas a venda e estoque, sem nota fiscal.
                </span>
              </span>
            </label>
          ) : null}
          {!editingSaleId && !enableNfceEmission ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <strong className="text-slate-800">NFC-e desligada para esta loja.</strong> As vendas registram apenas
              estoque e totais.
            </p>
          ) : null}
        </section>

        {/* 6 — Finalizar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          <Button className="min-w-[180px] text-sm" disabled={loading || items.length === 0}>
            {editingSaleId ? "Salvar edicao" : "Finalizar venda"}
          </Button>
          {editingSaleId ? (
            <Button type="button" variant="secondary" className="text-sm" onClick={cancelEdit}>
              Cancelar edicao
            </Button>
          ) : null}
        </div>
      </form>
      {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
    </SectionCard>
  );
}
