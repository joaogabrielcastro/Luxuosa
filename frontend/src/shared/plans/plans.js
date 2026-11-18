/**
 * Leitura (somente UI) das permissões de plano.
 * A fonte da verdade é o backend: `tenant.entitlements` vem de /auth/me e do login.
 * Nada aqui libera ou bloqueia API — só decide o que mostrar.
 */

export const PLAN_LABELS = {
  BASIC: "Básico",
  PRO: "Pro",
  ENTERPRISE: "Enterprise"
};

const PLAN_RANK = { BASIC: 0, PRO: 1, ENTERPRISE: 2 };

/** Espelho do catálogo do backend, usado apenas quando a sessão é antiga e não traz entitlements. */
const FALLBACK_MIN_PLAN = {
  nfeImport: "PRO",
  nfceEmission: "PRO",
  stockAlerts: "PRO",
  fiscalClosing: "PRO",
  billingPortal: "BASIC",
  advancedReports: "ENTERPRISE",
  storeNetwork: "ENTERPRISE"
};

export const FEATURE_LABELS = {
  nfeImport: "Entrada de mercadorias por NF-e",
  nfceEmission: "Emissão de NFC-e",
  stockAlerts: "Alertas automáticos de estoque",
  fiscalClosing: "Fechamento fiscal para o contador",
  advancedReports: "Relatórios avançados",
  storeNetwork: "Rede de lojas"
};

export function planLabel(plan) {
  return PLAN_LABELS[plan] || plan || "—";
}

/**
 * @returns {{ plan: string, exempt: boolean, maxUsers: number|null, has: (feature: string) => boolean, minPlan: (feature: string) => string }}
 */
export function resolveEntitlements(tenant) {
  const plan = tenant?.plan || "BASIC";
  const ent = tenant?.entitlements;
  const exempt = Boolean(ent?.planGateExempt ?? tenant?.planGateExempt);
  const minMap = ent?.featureMinPlan || FALLBACK_MIN_PLAN;

  function minPlan(feature) {
    return minMap[feature] || "BASIC";
  }

  function has(feature) {
    if (ent?.features && feature in ent.features) return Boolean(ent.features[feature]);
    // Sem dados do servidor: não bloquear na UI (a API continua decidindo).
    if (!ent) return true;
    if (exempt) return true;
    return (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[minPlan(feature)] ?? 0);
  }

  const fallbackMaxUsers = { BASIC: 3, PRO: 10, ENTERPRISE: null };
  const maxUsers = ent ? ent.maxUsers ?? null : exempt ? null : fallbackMaxUsers[plan] ?? 3;

  return { plan, exempt, maxUsers, has, minPlan };
}
