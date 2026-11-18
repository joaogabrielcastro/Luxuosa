import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.jsx";
import { apiClient } from "../../shared/apiClient.js";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Card } from "../../shared/components/ui/Card.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { Skeleton } from "../../shared/components/ui/Skeleton.jsx";
import { useQuery } from "@tanstack/react-query";
import { Check, CreditCard, Lock } from "lucide-react";
import { queryKeys } from "../../shared/queryKeys.js";
import { formatCurrencyBRL } from "../../shared/formatters.js";
import { useEntitlements } from "../../shared/plans/useEntitlements.js";
import { PlanBadge } from "../../shared/plans/PlanGate.jsx";
import { FEATURE_LABELS, planLabel } from "../../shared/plans/plans.js";

const statusLabel = {
  active: "Ativa",
  trialing: "Período de teste",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  unpaid: "Não paga",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada"
};

export function BillingPage() {
  const { token, user, tenant, refreshSession } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [error, setError] = useState("");
  const isAdmin = user?.type === "ADMIN";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient("/billing/status", { token });
      setStatus(data);
    } catch (err) {
      setError(err.message || "Não foi possível carregar a assinatura.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout) return;
    (async () => {
      if (checkout === "success") {
        showToast("Pagamento recebido. Sincronizando plano…", "success");
        try {
          const data = await apiClient("/billing/sync", { method: "POST", token });
          setStatus(data);
          // Atualiza permissões do plano na sessão (menu e telas liberadas).
          await refreshSession?.().catch(() => {});
        } catch {
          await load();
        }
      } else if (checkout === "cancel") {
        showToast("Pagamento cancelado.", "error");
      }
      setSearchParams({}, { replace: true });
    })();
  }, [searchParams, token]);

  async function startCheckout(plan) {
    if (!isAdmin) return;
    setBusyPlan(plan);
    try {
      const data = await apiClient("/billing/checkout", {
        method: "POST",
        token,
        body: { plan }
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("URL de checkout não retornada.");
    } catch (err) {
      showToast(err.message || "Falha ao abrir o pagamento.", "error");
      setBusyPlan("");
    }
  }

  async function openPortal() {
    if (!isAdmin) return;
    setBusyPlan("portal");
    try {
      const data = await apiClient("/billing/portal", { method: "POST", token });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("URL do portal não retornada.");
    } catch (err) {
      showToast(err.message || "Falha ao abrir o gerenciamento de pagamento.", "error");
      setBusyPlan("");
    }
  }

  const currentPlan = status?.currentPlan || tenant?.plan || "BASIC";
  const periodEnd = status?.planPeriodEnd ? new Date(status.planPeriodEnd).toLocaleDateString("pt-BR") : null;
  const { has, maxUsers, exempt } = useEntitlements();
  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(token),
    enabled: Boolean(token) && isAdmin,
    queryFn: () => apiClient("/users", { token })
  });
  const userCount = Array.isArray(usersQuery.data) ? usersQuery.data.length : (usersQuery.data?.items || []).length;
  const plans = status?.plans || [];
  const rank = { BASIC: 0, PRO: 1, ENTERPRISE: 2 };

  return (
    <div className="ui-page">
      <PageHeader
        title="Assinatura"
        description="Seu plano, o que ele inclui e como fazer upgrade. Planos pagos liberam nota fiscal (NFC-e) e entrada por NF-e."
        badge={<PlanBadge plan={currentPlan} />}
        actions={
          isAdmin && status?.hasStripeCustomer ? (
            <Button variant="secondary" icon={CreditCard} loading={busyPlan === "portal"} onClick={openPortal}>
              Gerenciar pagamento
            </Button>
          ) : null
        }
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {status?.planGateExempt ? (
        <Alert variant="info" title="Loja liberada dos bloqueios de plano">
          Esta loja está liberada dos bloqueios de plano por enquanto (cliente já existente). Você pode assinar quando quiser; os recursos continuam disponíveis.
        </Alert>
      ) : null}
      {status && !status.configured ? (
        <Alert variant="warning">Pagamentos ainda não estão configurados nesta loja. Contate o suporte.</Alert>
      ) : null}
      {!isAdmin ? <Alert variant="info">Apenas administradores podem alterar o plano da loja.</Alert> : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-champagne-100/70 blur-2xl" aria-hidden />
          <p className="ui-eyebrow">Plano atual</p>
          <p className="mt-1 font-display text-4xl text-slate-900">{plans.find((p) => p.id === currentPlan)?.name || planLabel(currentPlan)}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Situação</dt>
              <dd className="font-medium text-slate-900">
                {status?.subscriptionStatus ? statusLabel[status.subscriptionStatus] || status.subscriptionStatus : currentPlan === "BASIC" ? "Gratuito" : "—"}
              </dd>
            </div>
            {periodEnd ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Renova / válido até</dt>
                <dd className="num font-medium text-slate-900">{periodEnd}</dd>
              </div>
            ) : null}
            {isAdmin ? (
              <div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Usuários</dt>
                  <dd className="num font-medium text-slate-900">
                    {userCount} {maxUsers == null ? "· ilimitado" : `de ${maxUsers}`}
                  </dd>
                </div>
                {maxUsers ? (
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                    <div
                      className={`h-1.5 rounded-full ${userCount >= maxUsers ? "bg-amber-500" : "bg-brand-600"}`}
                      style={{ width: `${Math.min(100, (userCount / maxUsers) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </dl>
        </Card>

        <Card>
          <p className="ui-eyebrow mb-3">Recursos neste plano</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(FEATURE_LABELS).map(([feature, label]) => {
              const ok = has(feature);
              return (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  {ok ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-champagne-600" aria-hidden />
                  )}
                  <span className={ok ? "text-slate-800" : "text-slate-500"}>
                    {label}
                    {!ok ? <span className="sr-only"> (indisponível)</span> : null}
                    {feature === "nfceEmission" && ok && !tenant?.enableNfceEmission ? (
                      <span className="block text-xs text-slate-400">Incluído — ative em Configurações.</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {exempt ? <p className="mt-3 text-xs text-slate-500">Recursos liberados por isenção da loja.</p> : null}
        </Card>
      </section>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : (
        <section aria-label="Planos" className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isUpgrade = (rank[plan.id] ?? 0) > (rank[currentPlan] ?? 0);
            const hasCents = Number.isFinite(Number(plan.amountCents));
            const price = hasCents ? Number(plan.amountCents) / 100 : null;
            return (
              <Card key={plan.id} className={`flex flex-col ${plan.current ? "ring-2 ring-brand-600" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-2xl font-normal text-slate-900">{plan.name}</h2>
                  {plan.current ? <Badge variant="brand">Seu plano</Badge> : null}
                </div>
                <p className="mt-1 min-h-[2.5rem] text-sm text-slate-600">{plan.description}</p>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="num text-3xl font-semibold tracking-tight text-slate-900">
                    {price === null ? plan.priceLabel : price > 0 ? formatCurrencyBRL(price).replace(/,00$/, "") : "Grátis"}
                  </span>
                  {price > 0 ? <span className="text-sm text-slate-500">/mês</span> : null}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                  {(plan.features || []).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {plan.id === "BASIC" ? (
                    <p className="text-xs text-slate-500">Plano gratuito padrão. Para rebaixar, cancele em Gerenciar pagamento.</p>
                  ) : (
                    <Button
                      className="w-full"
                      variant={isUpgrade ? "primary" : "secondary"}
                      disabled={!isAdmin || !status?.configured || plan.current || Boolean(busyPlan)}
                      loading={busyPlan === plan.id}
                      onClick={() => startCheckout(plan.id)}
                    >
                      {busyPlan === plan.id ? "Redirecionando…" : plan.current ? "Plano ativo" : `Assinar ${plan.name}`}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
