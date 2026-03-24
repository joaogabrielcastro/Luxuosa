import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyInput } from "../../shared/formatters.js";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";

export function SalesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [sales, setSales] = useState([]);
  const [variations, setVariations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customerId: "",
    paymentMethod: "PIX",
    installments: 1,
    discountValue: 0,
    discountPercent: 0
  });
  const [items, setItems] = useState([{ productVariationId: "", quantity: 1, unitPrice: 0 }]);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    const [salesData, variationsData, customersData] = await Promise.all([
      apiClient("/sales", { token }),
      apiClient("/product-variations", { token }),
      apiClient("/customers", { token })
    ]);
    setSales(salesData);
    setVariations(variationsData);
    setCustomers(customersData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function addItem() {
    setItems((prev) => [...prev, { productVariationId: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateItem(index, key, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  async function createSale(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = editingSaleId ? `/sales/${editingSaleId}` : "/sales";
      const method = editingSaleId ? "PUT" : "POST";
      await apiClient(endpoint, {
        method,
        token,
        body: {
          ...form,
          installments: Number(form.installments),
          discountValue: Number(form.discountValue),
          discountPercent: Number(form.discountPercent),
          customerId: form.customerId || undefined,
          items: items.map((item) => ({
            productVariationId: item.productVariationId,
            quantity: Number(item.quantity),
            unitPrice: parseCurrencyInput(item.unitPrice)
          }))
        }
      });
      showToast(editingSaleId ? "Venda atualizada." : "Venda criada.");
      setEditingSaleId(null);
      setForm({
        customerId: "",
        paymentMethod: "PIX",
        installments: 1,
        discountValue: 0,
        discountPercent: 0
      });
      setItems([{ productVariationId: "", quantity: 1, unitPrice: 0 }]);
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
    setForm({
      customerId: sale.customerId || "",
      paymentMethod: sale.paymentMethod,
      installments: Number(sale.installments || 1),
      discountValue: Number(sale.discountValue || 0),
      discountPercent: Number(sale.discountPercent || 0)
    });
    setItems(
      sale.items.map((item) => ({
        productVariationId: item.productVariationId,
        quantity: Number(item.quantity),
        unitPrice: maskCurrencyInput(item.unitPrice)
      }))
    );
  }

  async function cancelSale(saleId) {
    setError("");
    try {
      const confirmed = await confirm({
        title: "Cancelar venda",
        message: "Deseja cancelar esta venda? Estoque e caixa serao estornados.",
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
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Nova venda</h2>
        <form className="mt-3 space-y-3" onSubmit={createSale}>
          <div className="grid gap-2 md:grid-cols-2">
            <select
              className="rounded border p-2"
              value={form.customerId}
              onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
            >
              <option value="">Cliente avulso</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border p-2"
              value={form.paymentMethod}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
            >
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="CREDIT_CARD">Cartao credito</option>
              <option value="DEBIT_CARD">Cartao debito</option>
              <option value="INSTALLMENT">Parcelado</option>
            </select>
            <input
              className="rounded border p-2"
              type="number"
              min="1"
              placeholder="Parcelas"
              disabled={form.paymentMethod !== "INSTALLMENT"}
              value={form.installments}
              onChange={(e) => setForm((prev) => ({ ...prev, installments: e.target.value }))}
            />
            <input
              className="rounded border p-2"
              type="number"
              placeholder="Desconto em valor"
              value={form.discountValue}
              onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
            />
            <input
              className="rounded border p-2"
              type="number"
              placeholder="Desconto em %"
              value={form.discountPercent}
              onChange={(e) => setForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
            />
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-3">
              <select
                className="rounded border p-2"
                value={item.productVariationId}
                onChange={(e) => updateItem(index, "productVariationId", e.target.value)}
              >
                <option value="">Selecione variacao</option>
                {variations.map((variation) => (
                  <option key={variation.id} value={variation.id}>
                    {variation.product?.name} - {variation.size}/{variation.color} (estoque: {variation.stock})
                  </option>
                ))}
              </select>
              <input
                className="rounded border p-2"
                type="number"
                placeholder="Quantidade"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
              />
              <input
                className="rounded border p-2"
                placeholder="Preco unitario"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, "unitPrice", maskCurrencyInput(e.target.value))}
              />
            </div>
          ))}

          <div className="flex gap-2">
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
                    customerId: "",
                    paymentMethod: "PIX",
                    installments: 1,
                    discountValue: 0,
                    discountPercent: 0
                  });
                  setItems([{ productVariationId: "", quantity: 1, unitPrice: 0 }]);
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
          { key: "actions", label: "Acoes" }
        ]}
        getRowKey={(row) => row.id}
        emptyMessage="Sem vendas."
        search={{
          query: search,
          onQueryChange: setSearch,
          placeholder: "Buscar por id ou pagamento...",
          matcher: (row, q) => `${row.id} ${row.paymentMethod}`.toLowerCase().includes(q.toLowerCase())
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
          }
        ]}
        renderCells={(sale) => (
          <>
            <td className="py-2">{new Date(sale.occurredAt).toLocaleString()}</td>
            <td className="py-2">{formatCurrencyBRL(sale.totalValue)}</td>
            <td className="py-2">{sale.paymentMethod}</td>
            <td className="py-2">{sale.status}</td>
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
    </div>
  );
}
