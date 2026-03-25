import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { formatDateBR } from "../../shared/formatters.js";
import { useAuth } from "../auth/useAuth.jsx";

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
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Faturamento do mes" value={`R$ ${Number(data.monthlyRevenue).toFixed(2)}`} />
        <Card title="Vendas do dia" value={String(data.daySales)} />
        <Card title="Ticket medio" value={`R$ ${Number(data.ticketAverage).toFixed(2)}`} />
        <Card title="Estoque baixo" value={`${data.lowStockCount} itens`} />
        <Card title="Ultimas vendas" value={data.lastSales.length ? String(data.lastSales.length) : "Sem dados"} />
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Vendas por atendente</h3>
        {data.salesByAttendant.length ? (
          <ul className="space-y-2 text-sm">
            {data.salesByAttendant.map((row) => (
              <li key={row.userId} className="rounded border p-2">
                {row.name} - vendas: {row.sales} - total: R$ {Number(row.amount).toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sem dados no periodo.</p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Lucro por produto</h3>
        {data.profitByProduct.length ? (
          <ul className="space-y-2 text-sm">
            {data.profitByProduct.slice(0, 8).map((row) => (
              <li key={row.productId} className="rounded border p-2">
                {row.name} - receita: R$ {Number(row.revenue).toFixed(2)} - lucro: R$ {Number(row.profit).toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sem vendas pagas para calcular lucro.</p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Produtos sem venda ha 30 dias</h3>
        {data.productsWithoutSales.length ? (
          <ul className="space-y-2 text-sm">
            {data.productsWithoutSales.slice(0, 8).map((row) => (
              <li key={row.productId} className="rounded border p-2">
                {row.name} - ultima venda: {row.lastSaleAt ? formatDateBR(row.lastSaleAt) : "Nunca"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Todos os produtos venderam recentemente.</p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Estoque consolidado</h3>
        {data.stockConsolidated.length ? (
          <ul className="space-y-2 text-sm">
            {data.stockConsolidated.slice(0, 8).map((row) => (
              <li key={row.productId} className="rounded border p-2">
                {row.name} - estoque total: {row.stock}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sem produtos cadastrados.</p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Vendas por periodo (mes atual)</h3>
        {data.salesByPeriod.length ? (
          <ul className="space-y-2 text-sm">
            {data.salesByPeriod.map((row) => (
              <li key={row.date} className="rounded border p-2">
                {formatDateBR(row.date)} - vendas: {row.count} - total: R$ {Number(row.amount).toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sem vendas no mes atual.</p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Produtos com estoque baixo</h3>
        {data.lowStockItems.length ? (
          <ul className="space-y-2 text-sm">
            {data.lowStockItems.map((item) => (
              <li key={item.id} className="rounded border p-2">
                {item.name} - atual: {item.currentStock} / minimo: {item.minStock}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sem alertas no momento.</p>
        )}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <article className="rounded-lg bg-white p-4 shadow">
      <p className="text-sm text-slate-500">{title}</p>
      <strong className="text-lg">{value}</strong>
    </article>
  );
}
