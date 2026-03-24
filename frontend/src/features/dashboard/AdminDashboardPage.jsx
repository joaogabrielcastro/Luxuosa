import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";

export function AdminDashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState({
    monthlyRevenue: 0,
    daySales: 0,
    lowStockCount: 0,
    lowStockItems: [],
    lastSales: []
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
        <Card title="Estoque baixo" value={`${data.lowStockCount} itens`} />
        <Card title="Ultimas vendas" value={data.lastSales.length ? String(data.lastSales.length) : "Sem dados"} />
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
