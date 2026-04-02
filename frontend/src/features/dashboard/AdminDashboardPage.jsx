import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { formatCurrencyBRL, formatDateBR } from "../../shared/formatters.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { AlertTriangle, DollarSign, Plug, ShoppingCart, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function AdminDashboardPage() {
  const { token, user, tenant } = useAuth();
  const { showToast } = useToast();
  const [nfceConn, setNfceConn] = useState(null);
  const [nfceConnLoading, setNfceConnLoading] = useState(false);
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient("/dashboard/admin", { token })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function runNfceConnectionTest() {
    setNfceConnLoading(true);
    setNfceConn(null);
    try {
      const data = await apiClient("/invoices/connection-test", { token });
      setNfceConn({ ok: true, data });
      showToast(`Nuvem Fiscal OK (${data?.environment || "—"}).`);
    } catch (err) {
      setNfceConn({
        ok: false,
        message: err.message,
        details: err.details
      });
      showToast(err.message, "error");
    } finally {
      setNfceConnLoading(false);
    }
  }

  const salesByAttendantData = useMemo(
    () =>
      (data.salesByAttendant || []).map((row) => ({
        name: row.name?.slice(0, 12) || "Atendente",
        vendas: Number(row.sales || 0)
      })),
    [data.salesByAttendant]
  );

  const salesByPeriodData = useMemo(
    () =>
      (data.salesByPeriod || []).map((row) => ({
        date: formatDateBR(row.date).slice(0, 5),
        total: Number(row.amount || 0)
      })),
    [data.salesByPeriod]
  );

  const profitByProductData = useMemo(
    () =>
      (data.profitByProduct || []).slice(0, 8).map((row) => ({
        name: String(row.name || "").slice(0, 16),
        lucro: Number(row.profit || 0)
      })),
    [data.profitByProduct]
  );

  return (
    <div className="ui-page">
      <PageHeader title="Dashboard" description="Visao geral operacional da loja." />
      {user?.type === "ADMIN" ? (
        <div className="mb-4">
        <SectionCard title="Fiscal — Nuvem Fiscal">
          <p className="text-xs text-slate-600">
            Testa OAuth e listagem de empresas na API da Nuvem (mesma rota que{" "}
            <code className="rounded bg-slate-100 px-1">GET /invoices/connection-test</code>). Depois finalize uma venda
            de teste na pagina Vendas (com NFC-e ligada para o tenant, se aplicavel) e confira o job na lista de vendas.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-2 text-sm"
              disabled={nfceConnLoading}
              onClick={runNfceConnectionTest}
            >
              <Plug className="h-4 w-4" />
              {nfceConnLoading ? "Testando..." : "Testar conexao Nuvem Fiscal"}
            </Button>
            {tenant?.enableNfceEmission ? (
              <span className="text-xs text-emerald-700">NFC-e habilitada para este tenant.</span>
            ) : (
              <span className="text-xs text-slate-500">NFC-e desligada nesta loja (vendas sem fila de nota).</span>
            )}
          </div>
          {nfceConn?.ok ? (
            <pre className="mt-3 max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
              {JSON.stringify(nfceConn.data, null, 2)}
            </pre>
          ) : null}
          {nfceConn && !nfceConn.ok ? (
            <Alert className="mt-3" variant="danger">
              {nfceConn.message}
              {nfceConn.details ? (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                  {typeof nfceConn.details === "string"
                    ? nfceConn.details
                    : JSON.stringify(nfceConn.details, null, 2)}
                </pre>
              ) : null}
            </Alert>
          ) : null}
        </SectionCard>
        </div>
      ) : null}
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Faturamento do mes"
          value={formatCurrencyBRL(data.monthlyRevenue)}
          hint="+12% vs periodo recente"
          icon={<DollarSign className="h-4 w-4 text-violet-600" />}
        />
        <StatCard
          label="Vendas do dia"
          value={`${data.daySales} vendas`}
          icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          label="Ticket medio"
          value={formatCurrencyBRL(data.ticketAverage)}
          icon={<Wallet className="h-4 w-4 text-indigo-600" />}
        />
        <StatCard
          label="Estoque baixo"
          value={`${data.lowStockCount} itens`}
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Vendas por atendente">
          {salesByAttendantData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByAttendantData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="vendas" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState description="Sem dados no periodo." />
          )}
        </SectionCard>

        <SectionCard title="Vendas por periodo (mes atual)">
          {salesByPeriodData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByPeriodData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(v) => formatCurrencyBRL(v)} />
                  <Line type="monotone" dataKey="total" stroke="#1E40AF" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState description="Sem vendas no mes atual." />
          )}
        </SectionCard>
      </section>

      <SectionCard title="Lucro por produto">
        {profitByProductData.length ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitByProductData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={110} />
                <Tooltip formatter={(v) => formatCurrencyBRL(v)} />
                <Bar dataKey="lucro" fill="#7C3AED" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState description="Sem vendas pagas para calcular lucro." />
        )}
      </SectionCard>

      <section className="grid gap-4 lg:grid-cols-2">
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
      </section>

      <SectionCard title="Produtos com estoque baixo">
        {data.lowStockItems.length ? (
          <ul className="space-y-2 text-sm">
            {data.lowStockItems.map((item) => {
              const zero = Number(item.currentStock) === 0;
              return (
                <li
                  key={item.id}
                  className={`rounded-lg border p-2.5 ${
                    zero
                      ? "border-rose-300 bg-rose-50 text-rose-950"
                      : "border-amber-300 bg-amber-50 text-amber-950"
                  }`}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="mt-0.5 block text-xs opacity-90">
                    Atual: <strong>{item.currentStock}</strong> · Minimo: <strong>{item.minStock}</strong>
                    {zero ? " · sem estoque" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState description="Sem alertas no momento." />
        )}
      </SectionCard>
      {loading ? <Alert variant="info">Atualizando indicadores...</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}
