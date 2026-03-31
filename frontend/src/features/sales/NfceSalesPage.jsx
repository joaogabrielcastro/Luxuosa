import { useCallback, useEffect, useMemo, useState } from "react";
import { apiBaseUrl, apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import {
  formatCurrencyBRL,
  formatDateTimeBR,
  maskCurrencyInput,
  parseCurrencyInput
} from "../../shared/formatters.js";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";

function variationsForCategoryAndBrand(variations, categoryId, brandId) {
  if (!categoryId || !brandId) return [];
  return variations.filter(
    (v) => v.product?.categoryId === categoryId && v.product?.brandId === brandId
  );
}

function brandIdsForCategory(variations, categoryId) {
  const ids = new Set();
  for (const v of variations) {
    if (v.product?.categoryId === categoryId && v.product?.brandId) ids.add(v.product.brandId);
  }
  return ids;
}

const emptyLineItem = () => ({
  categoryId: "",
  brandId: "",
  productVariationId: "",
  quantity: "",
  unitPrice: ""
});

const PAYMENT_LABELS = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartao credito",
  DEBIT_CARD: "Cartao debito",
  INSTALLMENT: "Parcelado"
};

const SALE_STATUS_LABELS = {
  OPEN: "Aberta",
  PAID: "Paga",
  CANCELED: "Cancelada"
};

const JOB_STATUS_LABELS = {
  PENDING: "Na fila",
  PROCESSING: "Processando",
  COMPLETED: "Concluido",
  FAILED: "Falhou"
};

function paymentLabel(method) {
  return PAYMENT_LABELS[method] || method;
}

function saleStatusLabel(status) {
  return SALE_STATUS_LABELS[status] || status;
}

function nfceJobStatusLabel(status) {
  return JOB_STATUS_LABELS[status] || status || "";
}

/** Página de vendas (NFC-e consumidor final, sem seleção de cliente na UI). */
export function SalesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [sales, setSales] = useState([]);
  const [variations, setVariations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    paymentMethod: "PIX",
    installments: 1,
    discountValue: "",
    discountPercent: ""
  });
  const [items, setItems] = useState([emptyLineItem()]);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("");
  const [nfceFilter, setNfceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [nfceErrorDetail, setNfceErrorDetail] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState("");

  const needsNfcePoll = useMemo(
    () =>
      sales.some(
        (s) => s.status === "PAID" && (!s.invoice || s.invoice.status === "PENDING")
      ),
    [sales]
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [categories]
  );

  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [brands]
  );

  const load = useCallback(async () => {
    const [salesData, variationsData, categoriesData, brandsData] = await Promise.all([
      apiClient("/sales", { token }),
      apiClient("/product-variations", { token }),
      apiClient("/categories", { token }),
      apiClient("/brands", { token })
    ]);
    setSales(salesData);
    setVariations(variationsData);
    setCategories(categoriesData);
    setBrands(brandsData);
  }, [token]);

  const refreshSales = useCallback(async () => {
    try {
      const salesData = await apiClient("/sales", { token });
      setSales(salesData);
    } catch {
      /* ignorar em background */
    }
  }, [token]);

  async function retryNfce(saleId) {
    setLoading(true);
    try {
      const inv = await apiClient(`/invoices/issue/${saleId}`, { method: "POST", token });
      showToast(
        inv?.key
          ? `NFC-e autorizada. Chave: ${String(inv.key).slice(0, 20)}...`
          : "NFC-e processada. Atualize a lista."
      );
      await load();
    } catch (err) {
      showToast(err.message || "Falha ao emitir NFC-e", "error");
    } finally {
      setLoading(false);
    }
  }

  async function downloadNfcePdf(saleId) {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/invoices/sale/${saleId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Falha ao baixar PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfce-${saleId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.message || "Falha ao baixar PDF", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return undefined;
    setError("");
    load().catch((err) => setError(err.message));
    return undefined;
  }, [token, load]);

  useEffect(() => {
    if (!needsNfcePoll || !token) return undefined;
    const id = setInterval(() => {
      refreshSales();
    }, 8000);
    return () => clearInterval(id);
  }, [needsNfcePoll, token, refreshSales]);

  function addItem() {
    setItems((prev) => [...prev, emptyLineItem()]);
  }

  function updateItem(index, key, value) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [key]: value };
        if (key === "categoryId") {
          next.brandId = "";
          next.productVariationId = "";
          next.unitPrice = "";
        }
        if (key === "brandId") {
          next.productVariationId = "";
          next.unitPrice = "";
        }
        if (key === "productVariationId") {
          const selectedVariation = variations.find((variation) => variation.id === value);
          const productPrice = Number(selectedVariation?.product?.price || 0);
          next.unitPrice = productPrice > 0 ? maskCurrencyInput(String(Math.round(productPrice * 100))) : "";
        }
        return next;
      })
    );
  }

  function parseQuantity(raw) {
    if (raw === "" || raw === undefined) return 1;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  function addItemByBarcode() {
    const code = String(barcodeInput || "").trim();
    if (!code) return;

    const candidates = variations.filter((v) => String(v.product?.sku || "").trim() === code);
    if (!candidates.length) {
      showToast("Codigo nao encontrado nos produtos.", "error");
      return;
    }

    const selected = candidates.find((v) => Number(v.stock) > 0) || candidates[0];
    const existingIdx = items.findIndex((it) => it.productVariationId === selected.id);
    const productPrice = Number(selected.product?.price || 0);
    const maskedUnitPrice = productPrice > 0 ? maskCurrencyInput(String(Math.round(productPrice * 100))) : "";

    if (existingIdx >= 0) {
      setItems((prev) =>
        prev.map((it, idx) => {
          if (idx !== existingIdx) return it;
          const current = Number(it.quantity || 0);
          return { ...it, quantity: String(Math.max(1, current) + 1) };
        })
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          categoryId: selected.product?.categoryId || "",
          brandId: selected.product?.brandId || "",
          productVariationId: selected.id,
          quantity: "1",
          unitPrice: maskedUnitPrice
        }
      ]);
    }

    setBarcodeInput("");
    showToast(`Item adicionado: ${selected.product?.name || "Produto"}.`);
  }

  async function createSale(event) {
    event.preventDefault();
    setError("");
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      if (!row.categoryId) {
        const msg = `Item ${i + 1}: selecione a categoria.`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      if (!row.brandId) {
        const msg = `Item ${i + 1}: selecione a marca.`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      if (!row.productVariationId) {
        const msg = `Item ${i + 1}: selecione o produto e a variacao.`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      const unit = parseCurrencyInput(row.unitPrice);
      if (unit <= 0) {
        const msg = `Item ${i + 1}: informe um preco unitario maior que zero.`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
      const qty = parseQuantity(row.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        const msg = `Item ${i + 1}: informe uma quantidade inteira (minimo 1).`;
        setError(msg);
        showToast(msg, "error");
        return;
      }
    }
    setLoading(true);
    try {
      const endpoint = editingSaleId ? `/sales/${editingSaleId}` : "/sales";
      const method = editingSaleId ? "PUT" : "POST";
      await apiClient(endpoint, {
        method,
        token,
        body: {
          ...form,
          installments:
            form.paymentMethod === "INSTALLMENT"
              ? Math.max(2, Number(form.installments) || 2)
              : 1,
          discountValue: form.discountValue === "" ? 0 : Number(form.discountValue),
          discountPercent: form.discountPercent === "" ? 0 : Number(form.discountPercent),
          items: items.map((item) => ({
            productVariationId: item.productVariationId,
            quantity: parseQuantity(item.quantity),
            unitPrice: parseCurrencyInput(item.unitPrice)
          }))
        }
      });
      showToast(editingSaleId ? "Venda atualizada." : "Venda criada.");
      setEditingSaleId(null);
      setForm({
        paymentMethod: "PIX",
        installments: 1,
        discountValue: "",
        discountPercent: ""
      });
      setItems([emptyLineItem()]);
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function editSale(sale) {
    setEditingSaleId(sale.id);
    const dv = Number(sale.discountValue || 0);
    const dp = Number(sale.discountPercent || 0);
    setForm({
      paymentMethod: sale.paymentMethod,
      installments: Math.max(1, Number(sale.installments || 1)),
      discountValue: dv !== 0 ? dv : "",
      discountPercent: dp !== 0 ? dp : ""
    });
    setItems(
      sale.items.map((item) => {
        const fromApi = item.productVariation;
        const fromList = variations.find((v) => v.id === item.productVariationId);
        const categoryId =
          fromApi?.product?.categoryId || fromList?.product?.categoryId || "";
        const brandId = fromApi?.product?.brandId || fromList?.product?.brandId || "";
        return {
          categoryId,
          brandId,
          productVariationId: item.productVariationId,
          quantity: String(item.quantity),
          unitPrice: maskCurrencyInput(String(Math.round(Number(item.unitPrice) * 100)))
        };
      })
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cancelSale(saleId) {
    setError("");
    try {
      const confirmed = await confirm({
        title: "Cancelar venda",
        message: "Deseja cancelar esta venda? O estoque sera estornado.",
        confirmText: "Cancelar venda"
      });
      if (!confirmed) return;
      await apiClient(`/sales/${saleId}/cancel`, {
        method: "POST",
        token
      });
      await load();
      showToast("Venda cancelada.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Vendas</h1>
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
            NFC-e · consumidor final
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Nota como consumidor final (sem cliente na tela).</p>
      </header>
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{editingSaleId ? "Editar venda" : "Nova venda"}</h2>
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <strong>NFC-e</strong> em <strong>consumidor final</strong> (sem cliente na nota). A lista atualiza sozinha
          enquanto a nota estiver pendente; em caso de erro use <strong>Tentar novamente</strong> ou{" "}
          <strong>Baixar PDF</strong> quando autorizada.
        </p>
        <form className="mt-4 space-y-6" onSubmit={createSale}>
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Pagamento</p>
            <p className="text-xs text-slate-500">
              A NFC-e é emitida automaticamente após finalizar a venda (Nuvem Fiscal / SEFAZ) como{" "}
              <strong>consumidor final</strong>, sem identificação do comprador na nota.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 md:max-w-xs">
                <span className="text-xs font-medium text-slate-600">Forma de pagamento</span>
                <select
                  className="rounded border p-2"
                  value={form.paymentMethod}
                  onChange={(e) => {
                    const paymentMethod = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      paymentMethod,
                      installments:
                        paymentMethod === "INSTALLMENT" ? Math.max(2, Number(prev.installments) || 2) : 1
                    }));
                  }}
                >
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CREDIT_CARD">Cartao credito</option>
                  <option value="DEBIT_CARD">Cartao debito</option>
                  <option value="INSTALLMENT">Parcelado</option>
                </select>
              </label>
            </div>
            {form.paymentMethod === "INSTALLMENT" ? (
              <label className="flex max-w-xs flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Numero de parcelas</span>
                <input
                  className="rounded border p-2"
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
                <input
                  className="rounded border p-2"
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
                <input
                  className="rounded border p-2"
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
                <input
                  className="w-full rounded border border-slate-300 bg-white p-2"
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
                <button type="button" className="rounded border px-3 py-2 text-sm" onClick={addItemByBarcode}>
                  Adicionar por codigo
                </button>
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
                      <select
                        className="rounded border border-slate-300 bg-white p-2"
                        value={item.categoryId}
                        onChange={(e) => updateItem(index, "categoryId", e.target.value)}
                      >
                        <option value="">Selecione a categoria</option>
                        {sortedCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">Marca</span>
                      <select
                        className="rounded border border-slate-300 bg-white p-2"
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
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">Produto e variacao</span>
                      <select
                        className="rounded border border-slate-300 bg-white p-2"
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
                            {variation.product?.name} — {variation.size}/{variation.color} (estoque:{" "}
                            {variation.stock})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">Quantidade</span>
                      <input
                        className="rounded border border-slate-300 bg-white p-2"
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
                      <input
                        className="rounded border border-slate-300 bg-white p-2"
                        inputMode="decimal"
                        placeholder="Ex.: 59,90"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, "unitPrice", maskCurrencyInput(e.target.value))}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={addItem}>
              Adicionar item
            </button>
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={loading}>
              {editingSaleId ? "Salvar edicao" : "Finalizar venda"}
            </button>
            {editingSaleId ? (
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setEditingSaleId(null);
                  setForm({
                    paymentMethod: "PIX",
                    installments: 1,
                    discountValue: "",
                    discountPercent: ""
                  });
                  setItems([emptyLineItem()]);
                }}
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      <DataTable
        title="Ultimas vendas"
        data={sales}
        columns={[
          { key: "date", label: "Data" },
          { key: "amount", label: "Total" },
          { key: "payment", label: "Pagamento" },
          { key: "status", label: "Status" },
          { key: "nfce", label: "NFC-e" },
          { key: "actions", label: "Acoes" }
        ]}
        getRowKey={(row) => row.id}
        emptyMessage="Sem vendas."
        pageSize={15}
        search={{
          query: search,
          onQueryChange: setSearch,
          placeholder: "Buscar por id, pagamento ou chave NFC-e...",
          matcher: (row, q) => {
            const needle = q.toLowerCase().trim();
            if (!needle) return true;
            const pay = paymentLabel(row.paymentMethod);
            const st = saleStatusLabel(row.status);
            const key = row.invoice?.key ? String(row.invoice.key) : "";
            const job = nfceJobStatusLabel(row.nfceJob?.status);
            const hay = `${row.id} ${row.paymentMethod} ${pay} ${row.status} ${st} ${key} ${job}`.toLowerCase();
            return hay.includes(needle);
          }
        }}
        filters={[
          {
            id: "payment",
            value: paymentFilter,
            onChange: setPaymentFilter,
            options: [
              { value: "", label: "Todos pagamentos" },
              { value: "PIX", label: "PIX" },
              { value: "CASH", label: "Dinheiro" },
              { value: "CREDIT_CARD", label: "Cartao credito" },
              { value: "DEBIT_CARD", label: "Cartao debito" },
              { value: "INSTALLMENT", label: "Parcelado" }
            ],
            matcher: (row, value) => row.paymentMethod === value
          },
          {
            id: "nfce",
            value: nfceFilter,
            onChange: setNfceFilter,
            options: [
              { value: "", label: "Todas NFC-e" },
              { value: "WAITING", label: "Sem registro" },
              { value: "PENDING", label: "Pendentes" },
              { value: "ISSUED", label: "Autorizadas" },
              { value: "ERROR", label: "Com erro" }
            ],
            matcher: (row, value) => {
              if (value === "WAITING") return !row.invoice;
              if (!row.invoice) return false;
              return row.invoice.status === value;
            }
          }
        ]}
        renderCells={(sale) => (
          <>
            <td className="py-2 whitespace-nowrap">{formatDateTimeBR(sale.occurredAt)}</td>
            <td className="py-2">{formatCurrencyBRL(sale.totalValue)}</td>
            <td className="py-2">{paymentLabel(sale.paymentMethod)}</td>
            <td className="py-2">{saleStatusLabel(sale.status)}</td>
            <td className="max-w-[220px] py-2 align-top text-xs">
              {sale.nfceJob?.status && sale.nfceJob.status !== "COMPLETED" ? (
                <div className="mb-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                  Fila: <strong>{nfceJobStatusLabel(sale.nfceJob.status)}</strong>
                  {sale.nfceJob.attempts ? ` · tentativas: ${sale.nfceJob.attempts}` : ""}
                </div>
              ) : null}
              {!sale.invoice ? (
                <div className="space-y-1">
                  <span className="text-slate-500">Aguardando NFC-e...</span>
                  {sale.status === "PAID" ? (
                    <button
                      type="button"
                      className="block w-full rounded border border-slate-300 px-2 py-1 text-left text-[11px] hover:bg-slate-50"
                      disabled={loading}
                      onClick={() => retryNfce(sale.id)}
                    >
                      Emitir agora
                    </button>
                  ) : null}
                </div>
              ) : sale.invoice.status === "ISSUED" ? (
                <div className="space-y-1">
                  <span className="font-medium text-emerald-700">Autorizada (SEFAZ)</span>
                  {sale.invoice.number ? <div className="text-slate-600">Nº {sale.invoice.number}</div> : null}
                  {sale.invoice.key ? (
                    <div className="break-all font-mono text-[10px] text-slate-500" title={sale.invoice.key}>
                      {sale.invoice.key.slice(0, 24)}…
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="mt-1 block w-full rounded bg-slate-900 px-2 py-1 text-left text-[11px] text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={loading}
                    onClick={() => downloadNfcePdf(sale.id)}
                  >
                    Baixar PDF da NFC-e
                  </button>
                </div>
              ) : sale.invoice.status === "ERROR" ? (
                <div className="space-y-1">
                  <div className="text-red-600" title={sale.invoice.lastError || ""}>
                    Erro na NFC-e
                    {sale.invoice.lastError ? `: ${String(sale.invoice.lastError).slice(0, 72)}…` : ""}
                  </div>
                  {sale.nfceJob?.status === "FAILED" && sale.nfceJob?.lastError ? (
                    <div className="text-[11px] text-slate-600" title={sale.nfceJob.lastError}>
                      Fila pausada: {String(sale.nfceJob.lastError).slice(0, 80)}…
                    </div>
                  ) : null}
                  {sale.invoice.lastError && String(sale.invoice.lastError).length > 72 ? (
                    <button
                      type="button"
                      className="text-left text-[11px] text-slate-600 underline"
                      onClick={() => setNfceErrorDetail(sale.invoice.lastError)}
                    >
                      Ver mensagem completa
                    </button>
                  ) : null}
                  {sale.status === "PAID" ? (
                    <button
                      type="button"
                      className="block w-full rounded border border-slate-300 px-2 py-1 text-left hover:bg-slate-50"
                      disabled={loading}
                      onClick={() => retryNfce(sale.id)}
                    >
                      Tentar NFC-e novamente
                    </button>
                  ) : null}
                </div>
              ) : (
                <span className="text-amber-700">Enviando NFC-e para SEFAZ...</span>
              )}
              {sale.status === "PAID" && sale.invoice?.status === "PENDING" ? (
                <button
                  type="button"
                  className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-left text-[11px] hover:bg-slate-50"
                  disabled={loading}
                  onClick={() => retryNfce(sale.id)}
                >
                  Forçar emissão NFC-e
                </button>
              ) : null}
            </td>
            <td className="py-2">
              {sale.status !== "CANCELED" ? (
                <div className="inline-flex gap-2">
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => editSale(sale)}>
                    Editar
                  </button>
                  <button className="rounded border border-red-600 px-2 py-1 text-xs text-red-700" onClick={() => cancelSale(sale.id)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">Sem acoes</span>
              )}
            </td>
          </>
        )}
      />

      {nfceErrorDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nfce-err-title"
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-4 shadow-lg">
            <h3 id="nfce-err-title" className="text-sm font-semibold">
              Detalhe do erro NFC-e
            </h3>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-slate-800">{nfceErrorDetail}</pre>
            <button
              type="button"
              className="mt-4 rounded bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={() => setNfceErrorDetail(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
