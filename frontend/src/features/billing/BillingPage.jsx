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
  const { token, user, tenant } = useAuth();
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
  const periodEnd = status?.planPeriodEnd
    ? new Date(status.planPeriodEnd).toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="ui-page">
      <PageHeader
        title="Assinatura"
        description="Escolha o plano da loja. Planos pagos liberam nota fiscal (NFC-e) e entrada por NF-e."
        badge={
          <Badge variant="info">
            {status?.plans?.find((p) => p.id === currentPlan)?.name || currentPlan}
          </Badge>
        }
        actions={
          isAdmin && status?.hasStripeCustomer ? (
            <Button variant="secondary" disabled={busyPlan === "portal"} onClick={openPortal}>
              {busyPlan === "portal" ? "Abrindo…" : "Gerenciar pagamento"}
            </Button>
          ) : null
        }
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {status?.planGateExempt ? (
        <Alert variant="info">
          Esta loja está liberada dos bloqueios de plano por enquanto (cliente já existente). Você
          pode assinar quando quiser; os recursos continuam disponíveis.
        </Alert>
      ) : null}
      {!status?.configured ? (
        <Alert variant="warning">
          Pagamentos ainda não estão configurados nesta loja. Contate o suporte.
        </Alert>
      ) : null}
      {!isAdmin ? (
        <Alert variant="info">Apenas administradores podem alterar o plano da loja.</Alert>
      ) : null}

      {status?.subscriptionStatus ? (
        <p className="text-sm text-slate-600">
          Status:{" "}
          <span className="font-medium text-slate-900">
            {statusLabel[status.subscriptionStatus] || status.subscriptionStatus}
          </span>
          {periodEnd ? ` · Renova / válido até ${periodEnd}` : null}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando planos…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(status?.plans || []).map((plan) => (
            <Card key={plan.id} className={plan.current ? "ring-2 ring-violet-400" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                </div>
                {plan.current ? <Badge variant="success">Atual</Badge> : null}
              </div>
              <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{plan.priceLabel}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {(plan.features || []).map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <div className="mt-5">
                {plan.id === "BASIC" ? (
                  <p className="text-xs text-slate-500">
                    Plano gratuito padrão. Para rebaixar, cancele em Gerenciar pagamento.
                  </p>
                ) : (
                  <Button
                    className="w-full"
                    disabled={!isAdmin || !status?.configured || plan.current || Boolean(busyPlan)}
                    onClick={() => startCheckout(plan.id)}
                  >
                    {busyPlan === plan.id
                      ? "Redirecionando…"
                      : plan.current
                        ? "Plano ativo"
                        : `Assinar ${plan.name}`}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
