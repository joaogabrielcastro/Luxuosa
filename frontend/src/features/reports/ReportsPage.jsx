import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { formatCurrencyBRL, formatDateBR } from "../../shared/formatters.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { FormErrorSummary } from "../../shared/components/FormErrorSummary.jsx";
import { paymentLabel } from "../sales/sales.utils.js";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function defaultFromTo() {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function escapeCsvCell(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Baixa um CSV a partir de linhas (arrays) no browser. */
function downloadCsv(filename, rows) {
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { token } = useAuth();
  const [{ from, to }, setRange] = useState(() => defaultFromTo());
  const [appliedRange, setAppliedRange] = useState(() => defaultFromTo());

  const salesQuery = useQuery({
    queryKey: queryKeys.reports.sales(token, appliedRange),
    enabled: Boolean(token),
    queryFn: () =>
      apiClient(
        `/reports/sales?from=${encodeURIComponent(appliedRange.from)}&to=${encodeURIComponent(appliedRange.to)}`,
        { token }
      )
  });

  const lowStockQuery = useQuery({
    queryKey: queryKeys.reports.lowStock(token),
    enabled: Boolean(token),
    staleTime: 60_000,
    queryFn: () => apiClient("/reports/low-stock", { token })
  });

  const salesReport = salesQuery.data ?? null;
  const lowStock = lowStockQuery.data ?? null;
  const error = salesQuery.error || lowStockQuery.error;
  const loading = salesQuery.isFetching || lowStockQuery.isFetching;
  const advanced = salesReport?.advanced || null;

  async function applyRange(e) {
    e.preventDefault();
    setAppliedRange({ from, to });
  }

  function exportSalesCsv() {
    if (!salesReport) return;
    const rows = [["day", "count", "amount"]];
    for (const row of salesReport.byDay || []) {
      rows.push([row.date, row.count, Number(row.amount || 0).toFixed(2)]);
    }
    rows.push(["TOTAL", salesReport.saleCount, Number(salesReport.totalAmount || 0).toFixed(2)]);
    downloadCsv(`vendas_${appliedRange.from}_${appliedRange.to}.csv`, rows);
  }

  function exportLowStockCsv() {
    if (!lowStock?.items?.length) return;
    const rows = [["name", "sku", "category", "brand", "currentStock", "minStock", "severity"]];
    for (const item of lowStock.items) {
      rows.push([
        item.name,
        item.sku || "",
        item.category || "",
        item.brand || "",
        item.currentStock,
        item.minStock,
        item.severity || ""
      ]);
    }
    downloadCsv("estoque_baixo.csv", rows);
  }

  function exportMixCsv() {
    if (!salesReport) return;
    const rows = [["tipo", "nome", "count", "amount"]];
    for (const row of salesReport.byPayment || []) {
      rows.push(["pagamento", paymentLabel(row.method), row.count, Number(row.amount || 0).toFixed(2)]);
    }
    for (const row of salesReport.byAttendant || []) {
      rows.push(["atendente", row.name, row.sales, Number(row.amount || 0).toFixed(2)]);
    }
    downloadCsv(`mix_${appliedRange.from}_${appliedRange.to}.csv`, rows);
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Relatórios"
        description="Intervalo à escolha, com gráfico, mix de pagamento e exportação CSV. A lista de reposição fica em Estoque."
      />
      <SectionCard title="Vendas por período">
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
            <span className="text-xs font-medium text-slate-600">Até</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </label>
          <Button type="submit" className="text-sm" disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-sm"
            disabled={!salesReport?.byDay?.length && !salesReport?.saleCount}
            onClick={exportSalesCsv}
          >
            Exportar CSV
          </Button>
        </form>
        {salesReport ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Vendas (pagas)" value={salesReport.saleCount} />
            <StatCard label="Total no período" value={formatCurrencyBRL(salesReport.totalAmount)} />
            <StatCard label="Ticket médio" value={formatCurrencyBRL(salesReport.ticketAverage || 0)} />
          </div>
        ) : null}
        {salesReport?.byDay?.length ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="h-64 rounded-lg border border-slate-200 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={salesReport.byDay.map((row) => ({
                    date: formatDateBR(row.date).slice(0, 5),
                    total: Number(row.amount || 0)
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(v) => formatCurrencyBRL(v)} />
                  <Line type="monotone" dataKey="total" stroke="#7C3AED" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
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
          </div>
        ) : salesReport && !salesReport.saleCount ? (
          <EmptyState description="Nenhuma venda paga neste intervalo." />
        ) : null}
      </SectionCard>

      <SectionCard
        title="Pagamento e atendentes"
        actions={
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            disabled={!salesReport?.byPayment?.length && !salesReport?.byAttendant?.length}
            onClick={exportMixCsv}
          >
            Exportar mix
          </Button>
        }
      >
        {salesReport?.byPayment?.length || salesReport?.byAttendant?.length ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-700">Por pagamento</h3>
              <ul className="space-y-1 text-sm">
                {(salesReport.byPayment || []).map((row) => (
                  <li key={row.method} className="flex justify-between rounded border border-slate-100 px-2 py-1">
                    <span>{paymentLabel(row.method)}</span>
                    <span>
                      {row.count} · {formatCurrencyBRL(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-700">Por atendente</h3>
              <ul className="space-y-1 text-sm">
                {(salesReport.byAttendant || []).map((row) => (
                  <li key={row.userId || row.name} className="flex justify-between rounded border border-slate-100 px-2 py-1">
                    <span>{row.name}</span>
                    <span>
                      {row.sales} · {formatCurrencyBRL(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <EmptyState description="Sem vendas pagas neste intervalo para montar o mix." />
        )}
      </SectionCard>

      {advanced ? (
        <SectionCard title="Análise Enterprise">
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <p className="text-xs font-medium text-slate-500">Período anterior</p>
              <p className="mt-1 font-semibold text-slate-900">
                {advanced.previous.saleCount} vendas · {formatCurrencyBRL(advanced.previous.totalAmount)}
              </p>
              <p className="text-xs text-slate-500">
                {formatDateBR(advanced.previous.from)} – {formatDateBR(advanced.previous.to)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <p className="text-xs font-medium text-slate-500">Este período</p>
              <p className="mt-1 font-semibold text-slate-900">
                {salesReport.saleCount} vendas · {formatCurrencyBRL(salesReport.totalAmount)}
              </p>
            </div>
          </div>
          {advanced.profitByProduct?.length ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-slate-700">Lucro por produto</h3>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {advanced.profitByProduct.map((row) => (
                  <li key={row.productId} className="flex justify-between rounded border border-slate-100 px-2 py-1">
                    <span>{row.name}</span>
                    <span>{formatCurrencyBRL(row.profit)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {advanced.productsWithoutSales?.length ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-slate-700">Sem venda no período</h3>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-700">
                {advanced.productsWithoutSales.map((row) => (
                  <li key={row.productId}>{row.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionCard>
      ) : (
        <SectionCard title="Análise Enterprise">
          <p className="mt-2 text-sm text-slate-600">
            Lucro no intervalo, comparação com o período anterior e produtos parados entram no plano Enterprise.
          </p>
          <Link to="/assinatura" className="mt-2 inline-block text-sm text-violet-700 hover:underline">
            Ver planos
          </Link>
        </SectionCard>
      )}

      <SectionCard title="Estoque abaixo do mínimo">
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm text-slate-600">
            {lowStock?.count
              ? `${lowStock.count} produto(s) para repor. A lista interativa está em Estoque.`
              : "Nenhum produto abaixo do mínimo no momento."}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="text-sm"
            disabled={!lowStock?.items?.length}
            onClick={exportLowStockCsv}
          >
            Exportar CSV
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link to="/estoque" className="text-violet-700 hover:underline">
            Ver o que repor
          </Link>
          <Link to="/estoque/alertas" className="text-violet-700 hover:underline">
            Disparar avisos
          </Link>
        </div>
      </SectionCard>

      <FormErrorSummary error={error} />
    </div>
  );
}
