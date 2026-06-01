import { useMemo, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useApiQuery } from "../../shared/hooks/useApiQuery.js";
import { formatCurrencyBRL, formatDateBR } from "../../shared/formatters.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { AlertTriangle, CheckCircle2, DollarSign, Plug, ShoppingCart, Wallet, XCircle } from "lucide-react";
import { Badge } from "../../shared/components/ui/Badge.jsx";
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

const EMPTY_DASHBOARD = {
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
};

export function AdminDashboardPage() {
  const { token, user, tenant } = useAuth();
  const { showToast } = useToast();
  const [nfceConn, setNfceConn] = useState(null);
  const [nfceConnLoading, setNfceConnLoading] = useState(false);

  const {
    data = EMPTY_DASHBOARD,
    error: dashboardError,
    isLoading: loading,
    isFetching,
    refetch
  } = useApiQuery(["dashboard", "admin"], "/dashboard/admin", { token });

  async function runNfceConnectionTest() {
    setNfceConnLoading(true);
    setNfceConn(null);
    try {
      const data = await apiClient("/invoices/connection-test", { token });
      setNfceConn({ ok: data?.ok === true, data });
      if (data?.ok) {
        showToast(`Nuvem Fiscal OK — emitente ${data.emitente?.cnpjFormatado || "—"}.`);
      } else {
        showToast("Conexão OK, mas há pendências na configuração fiscal.", "error");
      }
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
      <PageHeader title="Dashboard" description="Visão geral do desempenho da loja: vendas, ticket médio e alertas de estoque." />
      {user?.type === "ADMIN" ? (
        <div className="mb-4">
        <SectionCard
          title="Fiscal — Nuvem Fiscal"
          description="Verifica se o CNPJ desta loja está na conta Nuvem e pronto para emitir NFC-e. Outras empresas na mesma conta sandbox não são usadas aqui."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-2 text-sm"
              disabled={nfceConnLoading}
              onClick={runNfceConnectionTest}
            >
              <Plug className="h-4 w-4" />
              {nfceConnLoading ? "Verificando…" : "Verificar configuração fiscal"}
            </Button>
            {tenant?.enableNfceEmission ? (
              <Badge variant="success">NFC-e ativa nesta loja</Badge>
            ) : (
              <Badge variant="neutral">NFC-e desligada</Badge>
            )}
          </div>

          {tenant?.cnpj ? (
            <p className="mt-3 text-sm text-slate-600">
              CNPJ cadastrado nesta loja:{" "}
              <span className="font-semibold text-slate-900">{tenant.cnpj.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</span>
            </p>
          ) : null}

          {nfceConn?.data ? (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {nfceConn.data.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-600" aria-hidden />
                )}
                <span className="text-sm font-semibold text-slate-900">
                  {nfceConn.data.ok ? "Pronto para emitir" : "Configuração incompleta"}
                </span>
                <Badge variant={nfceConn.data.environment === "sandbox" ? "warning" : "info"}>
                  {nfceConn.data.environment === "sandbox" ? "Sandbox" : "Produção"}
                </Badge>
              </div>

              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Emitente na NFC-e</dt>
                  <dd className="font-medium text-slate-900">
                    {nfceConn.data.emitente?.cnpjFormatado || "—"}
                    {nfceConn.data.emitente?.nomeFantasia || nfceConn.data.emitente?.razaoSocial
                      ? ` — ${nfceConn.data.emitente.nomeFantasia || nfceConn.data.emitente.razaoSocial}`
                      : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Cadastro na Nuvem</dt>
                  <dd className="font-medium text-slate-900">
                    {nfceConn.data.emitente?.cadastradoNaNuvem ? "Sim" : "Não — cadastre este CNPJ no console"}
                  </dd>
                </div>
                {nfceConn.data.nfce?.ambiente ? (
                  <div>
                    <dt className="text-slate-500">Ambiente NFC-e (Nuvem)</dt>
                    <dd className="font-medium capitalize text-slate-900">{nfceConn.data.nfce.ambiente}</dd>
                  </div>
                ) : null}
              </dl>

              {nfceConn.data.warnings?.length ? (
                <ul className="space-y-2 border-t border-slate-200 pt-3">
                  {nfceConn.data.warnings.map((w) => (
                    <li key={w} className="flex gap-2 text-xs leading-relaxed text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}

              {nfceConn.data.otherEmpresasInAccountCount > 0 ? (
                <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">
                  Esta conta Nuvem tem mais {nfceConn.data.otherEmpresasInAccountCount} empresa(s)
                  cadastrada(s). Esta loja usa apenas o CNPJ acima.
                </p>
              ) : null}
            </div>
          ) : null}

          {nfceConn && !nfceConn.ok && nfceConn.message ? (
            <Alert className="mt-3" variant="danger" title="Falha na verificação">
              {nfceConn.message}
            </Alert>
          ) : null}
        </SectionCard>
        </div>
      ) : null}
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Faturamento do mes"
          value={formatCurrencyBRL(data.monthlyRevenue)}
          hint="Total de vendas no mês atual"
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
      {loading || isFetching ? <Alert variant="info">Atualizando indicadores...</Alert> : null}
      {dashboardError ? (
        <Alert variant="danger">
          {dashboardError.message}
          <button type="button" className="ml-2 underline" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </Alert>
      ) : null}
    </div>
  );
}
