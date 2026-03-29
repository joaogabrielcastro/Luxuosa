import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { formatCurrencyBRL, formatDateBR } from "../../shared/formatters.js";

function defaultFromTo() {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from, to };
}

export function ReportsPage() {
  const { token } = useAuth();
  const [{ from, to }, setRange] = useState(() => defaultFromTo());
  const [salesReport, setSalesReport] = useState(null);
  const [lowStock, setLowStock] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [s, l] = await Promise.all([
      apiClient(`/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { token }),
      apiClient("/reports/low-stock", { token })
    ]);
    setSalesReport(s);
    setLowStock(l);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function applyRange(e) {
    e.preventDefault();
    try {
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Vendas por periodo</h2>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={applyRange}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">De</span>
            <input
              className="rounded border p-2"
              type="date"
              value={from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Ate</span>
            <input
              className="rounded border p-2"
              type="date"
              value={to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </label>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            Atualizar
          </button>
        </form>
        {salesReport ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded border p-3">
              <p className="text-xs text-slate-500">Vendas (pagas)</p>
              <p className="text-xl font-semibold">{salesReport.saleCount}</p>
            </article>
            <article className="rounded border p-3">
              <p className="text-xs text-slate-500">Total no periodo</p>
              <p className="text-xl font-semibold">{formatCurrencyBRL(salesReport.totalAmount)}</p>
            </article>
          </div>
        ) : null}
        {salesReport?.byDay?.length ? (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-slate-700">Por dia</h3>
            <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {salesReport.byDay.map((row) => (
                <li key={row.date} className="flex justify-between rounded border border-slate-100 px-2 py-1">
                  <span>{formatDateBR(row.date)}</span>
                  <span>
                    {row.count} vendas — {formatCurrencyBRL(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : salesReport && !salesReport.saleCount ? (
          <p className="mt-3 text-sm text-slate-500">Nenhuma venda paga neste intervalo.</p>
        ) : null}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Estoque abaixo do minimo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Soma das variacoes por produto comparada ao estoque minimo cadastrado no produto.
        </p>
        {lowStock?.items?.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {lowStock.items.map((item) => (
              <li key={item.id} className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                <strong>{item.name}</strong> ({item.sku})
                {item.category ? <span className="text-slate-600"> — {item.category}</span> : null}
                {item.brand ? <span className="text-slate-600"> · {item.brand}</span> : null}
                <div className="text-xs text-amber-900">
                  Atual: {item.currentStock} / minimo: {item.minStock}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Nenhum produto abaixo do minimo no momento.</p>
        )}
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
