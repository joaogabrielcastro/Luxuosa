import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { useAuth } from "../../features/auth/useAuth.jsx";
import { FEATURE_LABELS, planLabel } from "./plans.js";
import { useEntitlements } from "./useEntitlements.js";
import { cn } from "../components/ui/helpers.js";

export function PlanBadge({ plan, className = "" }) {
  const isPaid = plan === "PRO" || plan === "ENTERPRISE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider ring-1 ring-inset",
        isPaid ? "bg-champagne-50 text-champagne-800 ring-champagne-200" : "bg-slate-100 text-slate-600 ring-slate-200",
        className
      )}
    >
      {isPaid ? <Sparkles className="h-3 w-3" aria-hidden /> : null}
      {planLabel(plan)}
    </span>
  );
}

/**
 * Cartão de recurso indisponível no plano atual, com caminho claro para o upgrade.
 */
export function UpgradeNotice({ feature, title, description, compact = false }) {
  const { user } = useAuth();
  const { minPlan } = useEntitlements();
  const required = minPlan(feature);
  const isAdmin = user?.type === "ADMIN";
  const label = title || FEATURE_LABELS[feature] || "Este recurso";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-champagne-200 bg-gradient-to-br from-champagne-50 via-white to-white",
        compact ? "p-4" : "p-6 sm:p-8"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-champagne-700 shadow-card ring-1 ring-champagne-200">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{label}</h2>
            <PlanBadge plan={required} />
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            {description || `Disponível a partir do plano ${planLabel(required)}. Seus dados e o restante do sistema continuam funcionando normalmente.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isAdmin ? (
              <Link to="/assinatura" className="ui-btn ui-btn-primary">
                Ver planos
              </Link>
            ) : (
              <p className="text-xs text-slate-500">Peça ao administrador da loja para conhecer os planos.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Renderiza `children` se o plano libera o recurso; caso contrário, mostra o aviso de upgrade. */
export function FeatureGate({ feature, children, fallback = null }) {
  const { has } = useEntitlements();
  if (has(feature)) return children;
  return fallback ?? <UpgradeNotice feature={feature} />;
}
