import { brandIdsForCategory, variationsForCategoryAndBrand } from "../sales.utils.js";
import { SectionCard } from "../../../shared/components/ui/SectionCard.jsx";
import { Alert } from "../../../shared/components/ui/Alert.jsx";
import { Input } from "../../../shared/components/ui/Input.jsx";
import { Select } from "../../../shared/components/ui/Select.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { formatCurrencyBRL, parseCurrencyInput } from "../../../shared/formatters.js";

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
  barcodeInput,
  setBarcodeInput,
  addItemByBarcode,
  addItem,
  loading,
  cancelEdit
}) {
  const subtotal = items.reduce((acc, item) => {
    const qty = Number(item.quantity || 0);
    const unit = parseCurrencyInput(item.unitPrice);
    if (!Number.isFinite(qty) || qty <= 0) return acc;
    return acc + qty * unit;
  }, 0);
  const discountValue = Number(form.discountValue || 0);
  const discountPercentValue = Number(form.discountPercent || 0);
  const discountFromPercent = subtotal * (discountPercentValue / 100);
  const totalDiscount = Math.max(0, discountValue + discountFromPercent);
  const total = Math.max(0, subtotal - totalDiscount);

  return (
    <SectionCard title={editingSaleId ? "Editar venda" : "Nova venda"}>

      <form className="mt-4 space-y-6" onSubmit={createSale}>
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Pagamento</p>
          <p className="text-xs text-slate-500">
            A NFC-e e emitida automaticamente apos finalizar a venda (Nuvem Fiscal / SEFAZ) como{" "}
            <strong>consumidor final</strong>, sem identificacao do comprador na nota.
          </p>
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
          </div>
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

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Descontos na venda (opcional)</p>
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
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Itens da venda</p>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">
              Leitura rapida por codigo: bip no scanner e Enter para adicionar automaticamente.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Codigo de barras / SKU"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItemByBarcode();
                  }
                }}
              />
              <Button type="button" variant="secondary" className="text-sm" onClick={addItemByBarcode}>
                Adicionar por codigo
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Escolha <strong>categoria</strong>, depois <strong>marca</strong>, depois o <strong>produto</strong>{" "}
            (tamanho/cor). Informe quantidade e preco unitario.
          </p>
          {items.map((item, index) => {
            const brandsInCat = brandIdsForCategory(variations, item.categoryId);
            const brandOptions = sortedBrands.filter((b) => brandsInCat.has(b.id));
            const filtered = variationsForCategoryAndBrand(variations, item.categoryId, item.brandId);
            return (
              <div
                key={index}
                className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 md:p-4"
              >
                <p className="text-sm font-semibold text-slate-800">Item {index + 1}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Categoria</span>
                    <Select
                      value={item.categoryId}
                      onChange={(e) => updateItem(index, "categoryId", e.target.value)}
                    >
                      <option value="">Selecione a categoria</option>
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
                      disabled={!item.categoryId}
                      value={item.brandId}
                      onChange={(e) => updateItem(index, "brandId", e.target.value)}
                    >
                      <option value="">
                        {!item.categoryId ? "Escolha uma categoria" : "Selecione a marca"}
                      </option>
                      {brandOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Produto e variacao</span>
                    <Select
                      disabled={!item.categoryId || !item.brandId}
                      value={item.productVariationId}
                      onChange={(e) => updateItem(index, "productVariationId", e.target.value)}
                    >
                      <option value="">
                        {!item.categoryId
                          ? "Escolha categoria e marca"
                          : !item.brandId
                            ? "Selecione a marca"
                            : "Selecione o produto"}
                      </option>
                      {filtered.map((variation) => (
                        <option key={variation.id} value={variation.id}>
                          {variation.product?.name} - {variation.size}/{variation.color} (estoque: {variation.stock})
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Quantidade</span>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Minimo 1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Preco unitario (R$)</span>
                    <Input
                      inputMode="decimal"
                      placeholder="Ex.: 59,90"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="text-sm" onClick={addItem}>
            Adicionar item
          </Button>
          <Button className="text-sm" disabled={loading}>
            {editingSaleId ? "Salvar edicao" : "Finalizar venda"}
          </Button>
          {editingSaleId ? (
            <Button type="button" variant="secondary" className="text-sm" onClick={cancelEdit}>
              Cancelar edicao
            </Button>
          ) : null}
        </div>
        <div className="grid gap-2 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-indigo-700">Subtotal</p>
            <p className="text-base font-semibold text-indigo-900">{formatCurrencyBRL(subtotal)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-700">Descontos</p>
            <p className="text-base font-semibold text-indigo-900">- {formatCurrencyBRL(totalDiscount)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-700">Total da compra</p>
            <p className="text-lg font-bold text-indigo-900">{formatCurrencyBRL(total)}</p>
          </div>
        </div>
      </form>
      {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
    </SectionCard>
  );
}
