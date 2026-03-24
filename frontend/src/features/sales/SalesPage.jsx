import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";

export function SalesPage() {
  const { token } = useAuth();
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
    try {
      await apiClient("/sales", {
        method: "POST",
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
            unitPrice: Number(item.unitPrice)
          }))
        }
      });
      setItems([{ productVariationId: "", quantity: 1, unitPrice: 0 }]);
      await load();
    } catch (err) {
      setError(err.message);
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
                type="number"
                step="0.01"
                placeholder="Preco unitario"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={addItem}>
              Adicionar item
            </button>
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Finalizar venda</button>
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-semibold">Ultimas vendas</h3>
        <ul className="space-y-2 text-sm">
          {sales.map((sale) => (
            <li key={sale.id} className="rounded border p-2">
              {new Date(sale.occurredAt).toLocaleString()} - R$ {Number(sale.totalValue).toFixed(2)} -{" "}
              {sale.paymentMethod}
            </li>
          ))}
          {!sales.length ? <li className="text-slate-500">Sem vendas.</li> : null}
        </ul>
      </div>
    </div>
  );
}
