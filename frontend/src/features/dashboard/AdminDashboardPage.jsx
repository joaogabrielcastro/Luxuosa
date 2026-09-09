import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApiQuery } from "../../shared/hooks/useApiQuery.js";
import { apiClient } from "../../shared/apiClient.js";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "../../shared/formatters.js";
import { useAuth } from "../auth/useAuth.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { queryKeys } from "../../shared/queryKeys.js";
import { paymentLabel } from "../sales/sales.utils.js";
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  PackagePlus,
  ShoppingCart,
  UserPlus,
  Wallet,
  WalletCards,
  Warehouse
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  PERIOD_PRESETS,
  fillDailySeries,
  lastDayDelta,
  rangeForPreset
} from "./periodRange.js";

const EMPTY_DASHBOARD = {
  monthlyRevenue: 0,
  daySales: 0,
  ticketAverage: 0,
  crediarioOpenBalance: 0,
  crediarioOpenCount: 0,
  crediarioReceivedMonth: 0,
  lowStockCount: 0,
  lowStockItems: [],
  lastSales: [],
  salesByPeriod: [],
  salesByAttendant: [],
  profitByProduct: [],
  productsWithoutSales: [],
  stockConsolidated: []
};

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function TextLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline">
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

function QuickAction({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-inherit no-underline shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50/40 sm:gap-3 sm:p-3.5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 hidden text-xs text-slate-600 sm:block">{description}</span>
      </span>
    </Link>
  );
}

function NewSaleButton({ className = "ui-btn ui-btn-primary w-full text-sm sm:w-auto" }) {
  return (
    <Link to="/vendas" className={className}>
      Nova venda
    </Link>
  );
}

function AttendantHome() {
  const { token } = useAuth();
  const lowStockQuery = useApiQuery(queryKeys.reports.lowStock(token), "/reports/low-stock", { token });
  const lowItems = lowStockQuery.data?.items ?? [];
  const criticalCount = lowItems.filter(
    (item) => item.severity === "critical" || Number(item.currentStock) === 0
  ).length;

  return (
    <div className="ui-page">
      <PageHeader
        title="Início"
        description="Atalhos do dia: vender, receber fiado e conferir o que falta no estoque."
        actions={<NewSaleButton />}
      />
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <QuickAction
          to="/vendas"
          icon={ShoppingCart}
          title="Nova venda"
          description="Registrar uma venda à vista."
        />
        <QuickAction
          to="/crediario"
          icon={WalletCards}
          title="Crediário"
          description="Quem está devendo e receber parcelas."
        />
        <QuickAction to="/caixa" icon={Wallet} title="Caixa" description="Acompanhar o movimento do dia." />
        <QuickAction
          to="/estoque"
          icon={AlertTriangle}
          title="Estoque"
          description="O que tem e o que precisa repor."
        />
      </section>
      {lowItems.length ? (
        <Alert
          variant={criticalCount > 0 ? "danger" : "warning"}
          title={
            criticalCount > 0
              ? `${criticalCount} produto(s) sem estoque`
              : `${lowItems.length} produto(s) com estoque baixo`
          }
        >
          <TextLink to="/estoque">Ver estoque</TextLink>
        </Alert>
      ) : null}
    </div>
  );
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  if (user?.type !== "ADMIN") {
    return <AttendantHome />;
  }
  return <AdminDashboardBody />;
}

function AdminDashboardBody() {
  const { token } = useAuth();
  const [periodId, setPeriodId] = useState("month");
  const range = useMemo(() => rangeForPreset(periodId), [periodId]);

  const {
    data = EMPTY_DASHBOARD,
    error: dashboardError,
    isLoading: loading,
    isFetching,
    refetch
  } = useApiQuery(queryKeys.dashboard.admin(token), "/dashboard/admin", { token });

  const salesReportQuery = useQuery({
    queryKey: queryKeys.reports.sales(token, range),
    enabled: Boolean(token),
    queryFn: () =>
      apiClient(`/reports/sales?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`, {
        token
      })
  });

  const openCreditQuery = useQuery({
    queryKey: queryKeys.crediario.list(token, { take: 5, skip: 0, q: "", statusFilter: "OPEN" }),
    enabled: Boolean(token),
    queryFn: () => apiClient("/crediario?take=5&skip=0&status=OPEN", { token })
  });

  const criticalCount = useMemo(
    () => (data.lowStockItems || []).filter((item) => Number(item.currentStock) === 0).length,
    [data.lowStockItems]
  );

  const cashMonth = Math.max(0, toNum(data.monthlyRevenue) - toNum(data.crediarioReceivedMonth));
  const receivedMonth = toNum(data.crediarioReceivedMonth);

  const periodSeries = useMemo(() => {
    const filled = fillDailySeries(range.from, range.to, salesReportQuery.data?.byDay);
    return filled.map((row) => ({
      ...row,
      label: formatDateBR(row.date).slice(0, 5),
      total: row.amount
    }));
  }, [range.from, range.to, salesReportQuery.data]);

  const periodHasSales = toNum(salesReportQuery.data?.saleCount) > 0 || toNum(salesReportQuery.data?.totalAmount) > 0;
  const periodDelta = lastDayDelta(periodSeries);

  const topProducts = useMemo(() => {
    return [...(data.profitByProduct || [])]
      .sort((a, b) => toNum(b.revenue) - toNum(a.revenue))
      .slice(0, 8);
  }, [data.profitByProduct]);

  const topProfit = useMemo(() => {
    return [...(data.profitByProduct || [])]
      .filter((row) => toNum(row.profit) !== 0 || toNum(row.revenue) > 0)
      .sort((a, b) => toNum(b.profit) - toNum(a.profit))
      .slice(0, 5);
  }, [data.profitByProduct]);

  const openAccounts = useMemo(() => {
    const rows = openCreditQuery.data?.items ?? [];
    return [...rows].sort((a, b) => toNum(b.remaining) - toNum(a.remaining)).slice(0, 5);
  }, [openCreditQuery.data]);

  const attendants = data.salesByAttendant || [];
  const lowItems = (data.lowStockItems || []).slice(0, 6);
  const lastSales = data.lastSales || [];
  const idleProducts = (data.productsWithoutSales || []).slice(0, 5);

  return (
    <div className="ui-page">
      <PageHeader
        title="Início"
        description="Centro de comando da loja: quanto vendeu, o que tem a receber e o que precisa de atenção."
        actions={<NewSaleButton />}
      />

      {dashboardError ? (
        <Alert variant="danger">
          {dashboardError.message}
          <button type="button" className="ml-2 underline" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </Alert>
      ) : null}

      <section aria-label="Ações rápidas">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Ações rápidas</h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <QuickAction to="/vendas" icon={ShoppingCart} title="Nova venda" description="Venda à vista no PDV." />
          <QuickAction
            to="/catalog/products"
            icon={PackagePlus}
            title="Novo produto"
            description="Cadastrar item e variações."
          />
          <QuickAction to="/clientes" icon={UserPlus} title="Novo cliente" description="Cadastro para crediário e vendas." />
          <QuickAction
            to="/estoque/movimentos"
            icon={Warehouse}
            title="Ajustar estoque"
            description="Entrada ou saída manual."
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Faturamento do mês"
          value={formatCurrencyBRL(data.monthlyRevenue)}
          hint={
            toNum(data.monthlyRevenue) || receivedMonth
              ? `À vista ${formatCurrencyBRL(cashMonth)} · recebimentos de crediário ${formatCurrencyBRL(receivedMonth)}`
              : "Vendas à vista pagas e recebimentos de crediário neste mês."
          }
          icon={<DollarSign className="h-4 w-4 text-violet-600" />}
          footer={<TextLink to="/relatorios">Ver relatórios</TextLink>}
        />
        <StatCard
          label="Vendas do dia"
          value={`${data.daySales} ${Number(data.daySales) === 1 ? "venda" : "vendas"}`}
          hint="À vista pagas e crediário lançado hoje."
          icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
          footer={<TextLink to="/vendas">Ir para vendas</TextLink>}
        />
        <StatCard
          label="Crediário em aberto"
          value={formatCurrencyBRL(data.crediarioOpenBalance)}
          hint={
            data.crediarioOpenCount
              ? `${data.crediarioOpenCount} conta(s) · recebido ${formatCurrencyBRL(receivedMonth)} este mês`
              : `Nada a receber · recebido ${formatCurrencyBRL(receivedMonth)} este mês`
          }
          icon={<WalletCards className="h-4 w-4 text-amber-600" />}
          tone={toNum(data.crediarioOpenBalance) > 0 ? "warning" : "default"}
          footer={<TextLink to="/crediario">Ver crediário</TextLink>}
        />
        <StatCard
          label="Ticket médio"
          value={formatCurrencyBRL(data.ticketAverage)}
          hint="Média das vendas à vista pagas e do crediário já quitado."
          icon={<Wallet className="h-4 w-4 text-indigo-600" />}
        />
        <StatCard
          label="Estoque baixo"
          value={`${data.lowStockCount} ${Number(data.lowStockCount) === 1 ? "item" : "itens"}`}
          hint={
            criticalCount
              ? `${criticalCount} sem estoque · o mínimo é o cadastrado em Produtos.`
              : "Produtos com estoque total igual ou abaixo do mínimo."
          }
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          tone={data.lowStockCount > 0 ? (criticalCount ? "danger" : "warning") : "default"}
          footer={<TextLink to="/estoque">Ver estoque</TextLink>}
        />
      </section>

      <SectionCard
        title="Vendas por período"
        description="Só vendas à vista pagas (Sale PAID). Recebimentos de crediário entram no faturamento do mês, não neste gráfico."
        actions={
          <div className="flex w-full gap-1 overflow-x-auto pb-0.5 sm:w-auto">
            {PERIOD_PRESETS.map((preset) => {
              const active = preset.id === periodId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPeriodId(preset.id)}
                  className={
                    active
                      ? "shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"
                      : "shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        }
      >
        {periodHasSales ? (
          <>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <p className="text-slate-600">
                Total no período:{" "}
                <strong className="text-slate-900">{formatCurrencyBRL(salesReportQuery.data?.totalAmount)}</strong>
              </p>
              <p className="text-slate-600">
                {salesReportQuery.data?.saleCount}{" "}
                {Number(salesReportQuery.data?.saleCount) === 1 ? "venda" : "vendas"}
              </p>
              {periodDelta ? (
                <p className={periodDelta.percent >= 0 ? "text-emerald-700" : "text-rose-700"}>
                  Último dia com venda {periodDelta.percent >= 0 ? "+" : ""}
                  {periodDelta.percent.toFixed(0)}% vs o dia anterior com venda
                </p>
              ) : null}
            </div>
            <div className="h-48 min-w-0 overflow-hidden sm:h-64 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={periodSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis width={36} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrencyBRL(v)} />
                  <Line type="monotone" dataKey="total" stroke="#1E40AF" strokeWidth={3} dot={periodSeries.length <= 14} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {lastSales.length ? (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Últimas vendas à vista</p>
                <ul className="space-y-1.5 text-sm">
                  {lastSales.slice(0, 5).map((sale) => (
                    <li key={sale.id} className="flex flex-col gap-0.5 rounded-lg bg-slate-50 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <span className="text-slate-700">
                        {sale.user?.name || "Atendente"} · {paymentLabel(sale.paymentMethod)}
                      </span>
                      <span className="font-medium text-slate-900">{formatCurrencyBRL(sale.totalValue)}</span>
                      <span className="text-xs text-slate-500 sm:text-right">{formatDateTimeBR(sale.occurredAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : salesReportQuery.isFetching ? (
          <p className="py-8 text-center text-sm text-slate-500">Carregando vendas do período…</p>
        ) : (
          <EmptyState
            compact
            title="Ainda não há vendas à vista neste período"
            description="Aqui aparece a evolução do que foi pago no PDV. Crediário não entra neste gráfico."
            actions={<NewSaleButton className="ui-btn ui-btn-primary text-sm" />}
          />
        )}
      </SectionCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Contas a receber"
          description="Saldo de fiado em aberto. Não entra no caixa."
          actions={<TextLink to="/crediario">Ver crediário</TextLink>}
        >
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs font-medium text-amber-800">Saldo em aberto</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrencyBRL(data.crediarioOpenBalance)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-slate-500">Contas em aberto</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{data.crediarioOpenCount}</p>
            </div>
          </div>
          {openAccounts.length ? (
            <ul className="space-y-2">
              {openAccounts.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{row.customer?.name || "Cliente"}</p>
                    <p className="text-xs text-slate-500">{formatDateTimeBR(row.occurredAt)}</p>
                  </div>
                  <p className="shrink-0 font-semibold text-amber-800">{formatCurrencyBRL(row.remaining)}</p>
                </li>
              ))}
            </ul>
          ) : toNum(data.crediarioOpenBalance) > 0 ? (
            <p className="text-sm text-slate-500">Há saldo em aberto. Abra o crediário para ver as contas.</p>
          ) : (
            <EmptyState
              compact
              title="Nenhuma conta em aberto"
              description="Quando o cliente levar agora e pagar depois, o saldo aparece aqui."
              actions={
                <Link to="/crediario" className="ui-btn ui-btn-secondary text-sm">
                  Abrir crediário
                </Link>
              }
            />
          )}
        </SectionCard>

        <SectionCard
          title="Estoque baixo"
          description="Mesma regra de Produtos: estoque total da variação vs mínimo do produto."
          actions={<TextLink to="/estoque">Ver estoque</TextLink>}
        >
          {lowItems.length ? (
            <ul className="space-y-2">
              {lowItems.map((item) => {
                const zero = Number(item.currentStock) === 0;
                return (
                  <li
                    key={item.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      zero ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <Badge variant={zero ? "danger" : "warning"}>{zero ? "Zerado" : "Baixo"}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Atual <strong>{item.currentStock}</strong> · mínimo <strong>{item.minStock}</strong>
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              compact
              title="Nada abaixo do mínimo"
              description="Quando um produto ficar no mínimo ou zerado, ele entra nesta lista."
              actions={
                <Link to="/estoque/movimentos" className="ui-btn ui-btn-secondary text-sm">
                  Ajustar estoque
                </Link>
              }
            />
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Produtos mais vendidos"
          description="Por valor vendido (à vista paga e crediário quitado)."
          actions={<TextLink to="/catalog/products">Ver produtos</TextLink>}
        >
          {topProducts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 font-semibold">Produto</th>
                    <th className="pb-2 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((row) => (
                    <tr key={row.productId} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-800">{row.name}</td>
                      <td className="py-2 text-right font-medium text-slate-900">{formatCurrencyBRL(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              title="Ainda não há produtos vendidos"
              description="O ranking usa o valor das vendas à vista pagas e do crediário quitado."
              actions={<NewSaleButton className="ui-btn ui-btn-primary text-sm" />}
            />
          )}
        </SectionCard>

        <SectionCard title="Desempenho da equipe" description="Vendas à vista pagas e crediário lançado, por atendente.">
          {attendants.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 font-semibold">Atendente</th>
                    <th className="pb-2 text-right font-semibold">Vendas</th>
                    <th className="pb-2 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {attendants.map((row) => (
                    <tr key={row.userId || row.name} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-800">{row.name}</td>
                      <td className="py-2 text-right text-slate-700">{row.sales}</td>
                      <td className="py-2 text-right font-medium text-slate-900">{formatCurrencyBRL(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              title="Sem movimento da equipe"
              description="O ranking aparece depois da primeira venda à vista paga ou crediário lançado."
              actions={<NewSaleButton className="ui-btn ui-btn-primary text-sm" />}
            />
          )}
        </SectionCard>
      </section>

      <SectionCard
        title="Lucro por produto"
        description="Receita menos custo cadastrado. Só vendas à vista pagas e crediário quitado."
      >
        {topProfit.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-semibold">Produto</th>
                  <th className="pb-2 text-right font-semibold">Receita</th>
                  <th className="pb-2 text-right font-semibold">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {topProfit.map((row) => (
                  <tr key={row.productId} className="border-t border-slate-100">
                    <td className="py-2 pr-3 text-slate-800">{row.name}</td>
                    <td className="py-2 text-right text-slate-700">{formatCurrencyBRL(row.revenue)}</td>
                    <td className="py-2 text-right font-medium text-slate-900">{formatCurrencyBRL(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            compact
            title="Sem lucro para mostrar"
            description="Cadastre o custo no produto e registre vendas à vista pagas ou quite um crediário."
            actions={<NewSaleButton className="ui-btn ui-btn-primary text-sm" />}
          />
        )}
      </SectionCard>

      {idleProducts.length ? (
        <SectionCard title="Produtos sem venda há 30 dias" description="À vista paga ou crediário (não cancelado).">
          <ul className="space-y-2 text-sm">
            {idleProducts.map((row) => (
              <li key={row.productId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                {row.name} — última venda: {row.lastSaleAt ? formatDateBR(row.lastSaleAt) : "Nunca"}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {loading || isFetching ? (
        <p className="text-center text-xs text-slate-400">Atualizando indicadores…</p>
      ) : null}
    </div>
  );
}
