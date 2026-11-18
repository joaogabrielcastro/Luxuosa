import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Lock,
  PackagePlus,
  Receipt,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Wallet,
  WalletCards,
  Warehouse
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApiQuery } from "../../shared/hooks/useApiQuery.js";
import { apiClient } from "../../shared/apiClient.js";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "../../shared/formatters.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useEntitlements } from "../../shared/plans/useEntitlements.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { SegmentedControl } from "../../shared/components/ui/SegmentedControl.jsx";
import { Skeleton } from "../../shared/components/ui/Skeleton.jsx";
import { queryKeys } from "../../shared/queryKeys.js";
import { paymentLabel } from "../sales/sales.utils.js";
import { PERIOD_PRESETS, fillDailySeries, rangeForPreset } from "./periodRange.js";

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

const BRAND_STROKE = "rgb(94 51 106)";

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pctChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function TextLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-900">
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

function QuickAction({ to, icon: Icon, title, description, primary = false }) {
  return (
    <Link
      to={to}
      className={
        primary
          ? "group flex items-center gap-3 rounded-xl bg-brand-800 p-3.5 text-white shadow-card transition-colors hover:bg-brand-900"
          : "group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-card transition-[border-color,box-shadow] hover:border-brand-200 hover:shadow-card-hover"
      }
    >
      <span
        className={
          primary
            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15"
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
        }
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className={primary ? "hidden text-xs text-white/70 sm:block" : "hidden text-xs text-slate-500 sm:block"}>{description}</span>
      </span>
    </Link>
  );
}

function RankList({ rows, valueKey = "amount", labelKey = "name", format = formatCurrencyBRL, empty }) {
  if (!rows.length) return empty;
  const max = Math.max(...rows.map((r) => toNum(r[valueKey])), 1);
  return (
    <ol className="space-y-3">
      {rows.map((row, i) => (
        <li key={row.productId || row.userId || row[labelKey] || i}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-800">
              <span className="num mr-2 text-xs text-slate-400">{i + 1}</span>
              {row[labelKey]}
            </span>
            <span className="num shrink-0 font-medium text-slate-900">{format(row[valueKey])}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.max(2, (toNum(row[valueKey]) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop">
      <p className="font-medium text-slate-900">{formatDateBR(row.date)}</p>
      <p className="num mt-0.5 text-slate-700">{formatCurrencyBRL(row.amount)}</p>
      <p className="num text-slate-500">
        {row.count} {row.count === 1 ? "venda" : "vendas"}
      </p>
    </div>
  );
}

function AttendantHome() {
  const { token, user } = useAuth();
  const lowStockQuery = useApiQuery(queryKeys.reports.lowStock(token), "/reports/low-stock", { token });
  const lowItems = lowStockQuery.data?.items ?? [];
  const criticalCount = lowItems.filter((item) => item.severity === "critical" || Number(item.currentStock) === 0).length;

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow={`${greeting()}, ${String(user?.name || "").split(" ")[0]}`}
        title="Início"
        description="Atalhos do dia: vender, receber fiado e conferir o que falta no estoque."
      />
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <QuickAction primary to="/vendas" icon={ShoppingBag} title="Nova venda" description="Abrir o PDV." />
        <QuickAction to="/crediario" icon={WalletCards} title="Crediário" description="Receber e lançar fiado." />
        <QuickAction to="/clientes" icon={UserPlus} title="Clientes" description="Consultar e cadastrar." />
        <QuickAction to="/estoque" icon={Warehouse} title="Estoque" description="O que tem e o que repor." />
      </section>
      {lowItems.length ? (
        <Alert
          variant={criticalCount > 0 ? "danger" : "warning"}
          title={criticalCount > 0 ? `${criticalCount} produto(s) sem estoque` : `${lowItems.length} produto(s) com estoque baixo`}
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
  const { token, user } = useAuth();
  const { has } = useEntitlements();
  const canCompare = has("advancedReports");
  const [periodId, setPeriodId] = useState("month");
  const range = useMemo(() => rangeForPreset(periodId), [periodId]);
  const todayRange = useMemo(() => rangeForPreset("today"), []);

  const {
    data = EMPTY_DASHBOARD,
    error: dashboardError,
    isLoading: loading,
    refetch
  } = useApiQuery(queryKeys.dashboard.admin(token), "/dashboard/admin", { token });

  const reportUrl = (r) => `/reports/sales?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;
  const salesReportQuery = useQuery({
    queryKey: queryKeys.reports.sales(token, range),
    enabled: Boolean(token),
    queryFn: () => apiClient(reportUrl(range), { token })
  });
  const todayQuery = useQuery({
    queryKey: queryKeys.reports.sales(token, todayRange),
    enabled: Boolean(token),
    queryFn: () => apiClient(reportUrl(todayRange), { token })
  });

  const openCreditQuery = useQuery({
    queryKey: queryKeys.crediario.list(token, { take: 5, skip: 0, q: "", statusFilter: "OPEN" }),
    enabled: Boolean(token),
    queryFn: () => apiClient("/crediario?take=5&skip=0&status=OPEN", { token })
  });

  const report = salesReportQuery.data;
  const today = todayQuery.data;
  const previous = report?.advanced?.previous;
  const todayPrevious = today?.advanced?.previous;

  const periodSeries = useMemo(() => {
    return fillDailySeries(range.from, range.to, report?.byDay).map((row) => ({
      ...row,
      label: formatDateBR(row.date).slice(0, 5)
    }));
  }, [range.from, range.to, report]);

  const periodHasSales = toNum(report?.saleCount) > 0;
  const periodLabel = PERIOD_PRESETS.find((p) => p.id === periodId)?.label.toLowerCase();

  const lowItems = useMemo(
    () => [...(data.lowStockItems || [])].sort((a, b) => toNum(a.currentStock) - toNum(b.currentStock)).slice(0, 5),
    [data.lowStockItems]
  );
  const criticalCount = (data.lowStockItems || []).filter((item) => Number(item.currentStock) === 0).length;

  const topProducts = useMemo(
    () => [...(data.profitByProduct || [])].sort((a, b) => toNum(b.revenue) - toNum(a.revenue)).slice(0, 6),
    [data.profitByProduct]
  );
  const topProfit = useMemo(
    () =>
      [...(data.profitByProduct || [])]
        .filter((row) => toNum(row.profit) !== 0 || toNum(row.revenue) > 0)
        .sort((a, b) => toNum(b.profit) - toNum(a.profit))
        .slice(0, 5),
    [data.profitByProduct]
  );
  const openAccounts = useMemo(() => {
    const rows = openCreditQuery.data?.items ?? [];
    return [...rows].sort((a, b) => toNum(b.remaining) - toNum(a.remaining)).slice(0, 5);
  }, [openCreditQuery.data]);
  const byPayment = useMemo(
    () => (report?.byPayment || []).map((r) => ({ ...r, name: paymentLabel(r.method) })),
    [report?.byPayment]
  );

  const attendants = data.salesByAttendant || [];
  const lastSales = data.lastSales || [];
  const idleProducts = (data.productsWithoutSales || []).slice(0, 5);
  const receivedMonth = toNum(data.crediarioReceivedMonth);
  const firstName = String(user?.name || "").split(" ")[0];

  const deltaLabel = canCompare ? "vs período anterior" : null;

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow={`${greeting()}${firstName ? `, ${firstName}` : ""} · ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}`}
        title="Início"
        description="Como a loja está hoje, o que entrou no período e o que precisa de atenção."
        actions={
          <Link to="/vendas" className="ui-btn ui-btn-primary">
            <ShoppingBag className="h-4 w-4" aria-hidden />
            Nova venda
          </Link>
        }
      />

      {dashboardError ? (
        <Alert
          variant="danger"
          title="Não foi possível carregar os indicadores"
          actions={
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => refetch()}>
              Tentar novamente
            </button>
          }
        >
          {dashboardError.message}
        </Alert>
      ) : null}

      {/* Hoje */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <StatCard
          label="Vendido hoje"
          value={formatCurrencyBRL(today?.totalAmount)}
          loading={todayQuery.isLoading}
          icon={Banknote}
          delta={canCompare && todayPrevious ? { percent: pctChange(toNum(today?.totalAmount), toNum(todayPrevious.totalAmount)), label: "vs ontem" } : null}
          hint="Vendas à vista pagas."
        />
        <StatCard
          label="Vendas hoje"
          value={String(toNum(data.daySales))}
          loading={loading}
          icon={Receipt}
          hint="À vista e crediário lançado hoje."
        />
        <StatCard
          label="Faturamento do mês"
          value={formatCurrencyBRL(data.monthlyRevenue)}
          loading={loading}
          icon={TrendingUp}
          hint={`À vista ${formatCurrencyBRL(Math.max(0, toNum(data.monthlyRevenue) - receivedMonth))} · crediário recebido ${formatCurrencyBRL(receivedMonth)}`}
          footer={<TextLink to="/relatorios">Relatórios</TextLink>}
        />
        <StatCard
          label="A receber (crediário)"
          value={formatCurrencyBRL(data.crediarioOpenBalance)}
          loading={loading}
          icon={WalletCards}
          tone={toNum(data.crediarioOpenBalance) > 0 ? "warning" : "default"}
          hint={`${toNum(data.crediarioOpenCount)} conta(s) em aberto · recebido ${formatCurrencyBRL(receivedMonth)} no mês`}
          footer={<TextLink to="/crediario">Ver crediário</TextLink>}
        />
        <StatCard
          label="Estoque baixo"
          value={`${toNum(data.lowStockCount)} ${toNum(data.lowStockCount) === 1 ? "produto" : "produtos"}`}
          loading={loading}
          icon={AlertTriangle}
          tone={data.lowStockCount > 0 ? (criticalCount ? "danger" : "warning") : "default"}
          hint={criticalCount ? `${criticalCount} sem nenhuma unidade.` : "No mínimo cadastrado ou abaixo."}
          footer={<TextLink to="/estoque">Ver o que repor</TextLink>}
        />
      </section>

      {/* Período */}
      <SectionCard
        title="Desempenho no período"
        description="Vendas à vista pagas. Recebimentos de crediário entram no faturamento do mês, não neste gráfico."
        actions={
          <SegmentedControl
            label="Período"
            value={periodId}
            onChange={setPeriodId}
            options={PERIOD_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          />
        }
      >
        <div className="grid gap-4 border-b border-slate-100 pb-4 sm:grid-cols-3">
          {[
            {
              label: "Faturamento",
              value: formatCurrencyBRL(report?.totalAmount),
              delta: previous ? pctChange(toNum(report?.totalAmount), toNum(previous.totalAmount)) : null
            },
            {
              label: "Quantidade de vendas",
              value: String(toNum(report?.saleCount)),
              delta: previous ? pctChange(toNum(report?.saleCount), toNum(previous.saleCount)) : null
            },
            {
              label: "Ticket médio",
              value: formatCurrencyBRL(report?.ticketAverage),
              delta:
                previous && previous.saleCount
                  ? pctChange(toNum(report?.ticketAverage), toNum(previous.totalAmount) / toNum(previous.saleCount))
                  : null
            }
          ].map((kpi) => (
            <div key={kpi.label}>
              <p className="text-[13px] text-slate-500">{kpi.label}</p>
              {salesReportQuery.isLoading ? (
                <Skeleton className="mt-1 h-8 w-28" />
              ) : (
                <p className="num mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{kpi.value}</p>
              )}
              {kpi.delta !== null && Number.isFinite(kpi.delta) ? (
                <p className={`num mt-0.5 text-xs font-medium ${kpi.delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {kpi.delta >= 0 ? "▲" : "▼"} {Math.abs(kpi.delta).toFixed(0)}% <span className="font-normal text-slate-500">{deltaLabel}</span>
                </p>
              ) : null}
            </div>
          ))}
        </div>
        {!canCompare ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-champagne-600" aria-hidden />
            Comparação com o período anterior faz parte dos relatórios avançados (plano Enterprise).
          </p>
        ) : null}

        {periodHasSales ? (
          <div className="mt-4 h-56 min-w-0 sm:h-72" role="img" aria-label={`Faturamento por dia — ${periodLabel}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={periodSeries} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="luxArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND_STROKE} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={BRAND_STROKE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgb(231 228 223)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "rgb(120 113 106)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  width={60}
                  tick={{ fontSize: 11, fill: "rgb(120 113 106)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${v}`)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgb(168 162 154)", strokeDasharray: "3 3" }} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={BRAND_STROKE}
                  strokeWidth={2}
                  fill="url(#luxArea)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: BRAND_STROKE }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : salesReportQuery.isFetching ? (
          <Skeleton className="mt-4 h-56 w-full sm:h-72" />
        ) : (
          <div className="mt-4">
            <EmptyState
              compact
              icon={TrendingUp}
              title="Nenhuma venda à vista neste período"
              description="Assim que o PDV registrar vendas, a evolução aparece aqui."
              actions={
                <Link to="/vendas" className="ui-btn ui-btn-primary ui-btn-sm">
                  Abrir o PDV
                </Link>
              }
            />
          </div>
        )}
      </SectionCard>

      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Formas de pagamento" description={`No período (${periodLabel}).`}>
          <RankList
            rows={byPayment}
            empty={<p className="text-sm text-slate-500">Sem vendas no período.</p>}
          />
        </SectionCard>

        <SectionCard title="Quem está devendo" description="Maiores saldos em aberto no crediário." actions={<TextLink to="/crediario">Crediário</TextLink>}>
          {openAccounts.length ? (
            <ul className="divide-y divide-slate-100">
              {openAccounts.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{row.customer?.name || "Cliente"}</p>
                    <p className="num text-xs text-slate-500">{formatDateBR(row.occurredAt)}</p>
                  </div>
                  <p className="num shrink-0 text-sm font-semibold text-amber-800">{formatCurrencyBRL(row.remaining)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Wallet} title="Nenhuma conta em aberto" description="Vendas a prazo aparecem aqui até serem quitadas." />
          )}
        </SectionCard>

        <SectionCard title="Repor estoque" description="Produtos no mínimo ou abaixo." actions={<TextLink to="/estoque">Estoque</TextLink>}>
          {lowItems.length ? (
            <ul className="divide-y divide-slate-100">
              {lowItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{[item.brand, item.category].filter(Boolean).join(" · ") || `mínimo ${item.minStock}`}</p>
                  </div>
                  <Badge variant={Number(item.currentStock) === 0 ? "danger" : "warning"} dot>
                    <span className="num">
                      {item.currentStock}/{item.minStock}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Warehouse} title="Estoque em dia" description="Nada no mínimo ou abaixo agora." />
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Produtos mais vendidos" description="Por valor vendido (à vista paga e crediário quitado)." actions={<TextLink to="/catalog/products">Produtos</TextLink>}>
          <RankList
            rows={topProducts}
            valueKey="revenue"
            empty={<EmptyState compact title="Ainda não há produtos vendidos" description="O ranking aparece depois das primeiras vendas." />}
          />
        </SectionCard>

        <SectionCard title="Desempenho da equipe" description="Vendas à vista pagas e crediário lançado, por atendente.">
          {attendants.length ? (
            <ul className="divide-y divide-slate-100">
              {attendants.map((row) => (
                <li key={row.userId || row.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <span className="truncate text-sm text-slate-800">{row.name}</span>
                  <span className="flex shrink-0 items-baseline gap-4">
                    <span className="num text-xs text-slate-500">{row.sales} vendas</span>
                    <span className="num text-sm font-semibold text-slate-900">{formatCurrencyBRL(row.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Sem movimento da equipe" description="O ranking aparece depois da primeira venda." />
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Lucro por produto" description="Receita menos o custo cadastrado no produto.">
          {topProfit.length ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-2xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="pb-2 font-semibold">Produto</th>
                  <th className="pb-2 text-right font-semibold">Receita</th>
                  <th className="pb-2 text-right font-semibold">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {topProfit.map((row) => (
                  <tr key={row.productId} className="border-t border-slate-100">
                    <td className="py-2 pr-3 text-slate-800">{row.name}</td>
                    <td className="num py-2 text-right text-slate-600">{formatCurrencyBRL(row.revenue)}</td>
                    <td className="num py-2 text-right font-medium text-slate-900">{formatCurrencyBRL(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState compact title="Sem lucro para mostrar" description="Cadastre o custo nos produtos e registre vendas." />
          )}
        </SectionCard>

        <SectionCard title="Últimas vendas" actions={<TextLink to="/vendas/historico">Histórico</TextLink>}>
          {lastSales.length ? (
            <ul className="divide-y divide-slate-100">
              {lastSales.slice(0, 5).map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">
                      {sale.user?.name || "Atendente"} · {paymentLabel(sale.paymentMethod)}
                    </p>
                    <p className="num text-xs text-slate-500">{formatDateTimeBR(sale.occurredAt)}</p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-slate-900">{formatCurrencyBRL(sale.totalValue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Nenhuma venda ainda" description="As vendas do PDV aparecem aqui." />
          )}
        </SectionCard>
      </section>

      {idleProducts.length ? (
        <SectionCard title="Parados há 30 dias" description="Produtos sem venda recente — bons candidatos a vitrine ou promoção.">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {idleProducts.map((row) => (
              <li key={row.productId} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm">
                <p className="truncate font-medium text-slate-800">{row.name}</p>
                <p className="text-xs text-slate-500">Última venda: {row.lastSaleAt ? formatDateBR(row.lastSaleAt) : "nunca"}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <section aria-label="Ações rápidas" className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <QuickAction to="/catalog/products" icon={PackagePlus} title="Novo produto" description="Cadastrar peça e grade." />
        <QuickAction to="/clientes" icon={UserPlus} title="Novo cliente" description="Para crediário e vendas." />
        <QuickAction to="/estoque/movimentos" icon={Warehouse} title="Ajustar estoque" description="Entrada ou saída manual." />
        <QuickAction to="/relatorios" icon={TrendingUp} title="Relatórios" description="Período, pagamentos e equipe." />
      </section>
    </div>
  );
}
