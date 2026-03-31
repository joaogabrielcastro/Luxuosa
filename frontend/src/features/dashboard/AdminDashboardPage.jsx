import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { formatDateBR } from "../../shared/formatters.js";
import { useAuth } from "../auth/useAuth.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";

export function AdminDashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState({
    monthlyRevenue: 0,
    daySales: 0,
    ticketAverage: 0,
    lowStockCount: 0,
    lowStockItems: [],
    lastSales: [],
    salesByPeriod: [],
    salesByAttendant: [],
    profitByProduct: [],
    productsWithoutSales: [],
    stockConsolidated: []
  });
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient("/dashboard/admin", { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  return (
    <div className="ui-page">
      <PageHeader title="Dashboard" description="Visao geral operacional da loja." />
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Faturamento do mes" value={`R$ ${Number(data.monthlyRevenue).toFixed(2)}`} />
        <StatCard label="Vendas do dia" value={String(data.daySales)} />
        <StatCard label="Ticket medio" value={`R$ ${Number(data.ticketAverage).toFixed(2)}`} />
        <StatCard label="Estoque baixo" value={`${data.lowStockCount} itens`} />
      </section>

      <SectionCard title="Vendas por atendente">
        {data.salesByAttendant.length ? (
          <ul className="space-y-2 text-sm">
            {data.salesByAttendant.map((row) => (
              <li key={row.userId} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                {row.name} - vendas: {row.sales} - total: R$ {Number(row.amount).toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description="Sem dados no periodo." />
        )}
      </SectionCard>

      <SectionCard title="Lucro por produto">
        {data.profitByProduct.length ? (
          <ul className="space-y-2 text-sm">
            {data.profitByProduct.slice(0, 8).map((row) => (
              <li key={row.productId} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                {row.name} - receita: R$ {Number(row.revenue).toFixed(2)} - lucro: R$ {Number(row.profit).toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description="Sem vendas pagas para calcular lucro." />
        )}
      </SectionCard>

      <SectionCard title="Produtos sem venda ha 30 dias">
        {data.productsWithoutSales.length ? (
          <ul className="space-y-2 text-sm">
            {data.productsWithoutSales.slice(0, 8).map((row) => (
              <li key={row.productId} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                {row.name} - ultima venda: {row.lastSaleAt ? formatDateBR(row.lastSaleAt) : "Nunca"}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description="Todos os produtos venderam recentemente." />
        )}
      </SectionCard>

      <SectionCard title="Estoque consolidado">
        {data.stockConsolidated.length ? (
          <ul className="space-y-2 text-sm">
            {data.stockConsolidated.slice(0, 8).map((row) => (
              <li key={row.productId} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                {row.name} - estoque total: {row.stock}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description="Sem produtos cadastrados." />
        )}
      </SectionCard>

      <SectionCard title="Vendas por periodo (mes atual)">
        {data.salesByPeriod.length ? (
          <ul className="space-y-2 text-sm">
            {data.salesByPeriod.map((row) => (
              <li key={row.date} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                {formatDateBR(row.date)} - vendas: {row.count} - total: R$ {Number(row.amount).toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description="Sem vendas no mes atual." />
        )}
      </SectionCard>

      <SectionCard title="Produtos com estoque baixo">
        {data.lowStockItems.length ? (
          <ul className="space-y-2 text-sm">
            {data.lowStockItems.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                {item.name} - atual: {item.currentStock} / minimo: {item.minStock}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description="Sem alertas no momento." />
        )}
      </SectionCard>
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}
