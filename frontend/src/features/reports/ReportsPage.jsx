import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { formatCurrencyBRL, formatDateBR } from "../../shared/formatters.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";

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
    <div className="ui-page">
      <PageHeader title="Relatorios" description="Acompanhe vendas e alertas de estoque." />
      <SectionCard title="Vendas por periodo">
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={applyRange}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">De</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Ate</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </label>
          <Button type="submit" className="text-sm">
            Atualizar
          </Button>
        </form>
        {salesReport ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Vendas (pagas)" value={salesReport.saleCount} />
            <StatCard label="Total no periodo" value={formatCurrencyBRL(salesReport.totalAmount)} />
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
          <EmptyState description="Nenhuma venda paga neste intervalo." />
        ) : null}
      </SectionCard>

      <SectionCard title="Estoque abaixo do minimo">
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
          <EmptyState description="Nenhum produto abaixo do minimo no momento." />
        )}
      </SectionCard>

      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}
