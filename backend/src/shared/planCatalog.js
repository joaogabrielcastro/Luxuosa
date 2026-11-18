/**
 * Planos comerciais Luxuosa ↔ Stripe (lookup_key nos Prices).
 * BASIC e gratuito (sem assinatura). PRO/ENTERPRISE via Checkout.
 *
 * @typedef {"BASIC"|"PRO"|"ENTERPRISE"} PlanId
 *
 * @typedef {object} PlanInfo
 * @property {PlanId} id
 * @property {string} name
 * @property {string} description
 * @property {string} priceLabel
 * @property {number} amountCents
 * @property {string[]} features
 */

/** @type {Record<PlanId, number>} */
export const PLAN_RANK = {
  BASIC: 0,
  PRO: 1,
  ENTERPRISE: 2
};

/** @type {Record<"PRO"|"ENTERPRISE", string>} */
export const STRIPE_PLAN_LOOKUP_KEYS = {
  PRO: "luxuosa_pro_monthly",
  ENTERPRISE: "luxuosa_enterprise_monthly"
};

/** Catalogo local (UI + setup Stripe). Valores em centavos BRL.
 * @type {Record<PlanId, PlanInfo>}
 */
export const PLAN_CATALOG = {
  BASIC: {
    id: "BASIC",
    name: "Básico",
    description: "Catálogo, vendas, estoque manual e crediário.",
    priceLabel: "Gratis",
    amountCents: 0,
    features: ["Catálogo e variações", "Vendas e estoque", "Crediário", "Até 3 usuários"]
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    description: "Fiscal NFC-e, importação de NF-e e alertas de estoque.",
    priceLabel: "R$ 97/mes",
    amountCents: 9700,
    features: [
      "Tudo do Básico",
      "Emissão NFC-e (quando habilitada na loja)",
      "Importação de NF-e de entrada",
      "Relatórios e exportação",
      "Até 10 usuários"
    ]
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Rede de lojas no mesmo e-mail, relatórios avançados e usuários ilimitados.",
    priceLabel: "R$ 250/mes",
    amountCents: 25000,
    features: [
      "Tudo do Pro",
      "Troca de loja no mesmo e-mail",
      "Relatórios avançados (lucro, comparação, parados)",
      "Usuários ilimitados",
      "Suporte prioritário"
    ]
  }
};

/** Limite de usuarios por plano. null = ilimitado.
 * @type {Record<PlanId, number|null>}
 */
export const PLAN_MAX_USERS = {
  BASIC: 3,
  PRO: 10,
  ENTERPRISE: null
};

/** Features que exigem plano minimo.
 * @type {Record<string, PlanId>}
 */
export const FEATURE_MIN_PLAN = {
  nfeImport: "PRO",
  nfceEmission: "PRO",
  stockAlerts: "PRO",
  billingPortal: "BASIC",
  fiscalClosing: "PRO",
  advancedReports: "ENTERPRISE",
  storeNetwork: "ENTERPRISE"
};

/**
 * @param {{ plan?: string|null, planGateExempt?: boolean|null }|null|undefined} tenant
 * @returns {number|null}
 */
export function planMaxUsers(tenant) {
  if (tenant?.planGateExempt) return null;
  const plan = /** @type {PlanId} */ (tenant?.plan || "BASIC");
  return PLAN_MAX_USERS[plan] ?? PLAN_MAX_USERS.BASIC;
}

/**
 * @param {string|null|undefined} currentPlan
 * @param {PlanId|string} requiredPlan
 * @returns {boolean}
 */
export function planAtLeast(currentPlan, requiredPlan) {
  const cur = PLAN_RANK[/** @type {PlanId} */ (currentPlan)] ?? 0;
  const need = PLAN_RANK[/** @type {PlanId} */ (requiredPlan)] ?? 0;
  return cur >= need;
}

/**
 * Acesso efetivo ao recurso: plano minimo OU loja legada (planGateExempt).
 * @param {{ plan?: string|null, planGateExempt?: boolean|null }|null|undefined} tenant
 * @param {PlanId|string} requiredPlan
 * @returns {boolean}
 */
export function tenantMeetsPlan(tenant, requiredPlan) {
  if (tenant?.planGateExempt) return true;
  return planAtLeast(tenant?.plan, requiredPlan);
}

/**
 * @param {unknown} value
 * @returns {PlanId|null}
 */
export function normalizeStripePlan(value) {
  const plan = String(value || "").toUpperCase();
  if (plan === "PRO" || plan === "ENTERPRISE" || plan === "BASIC") return /** @type {PlanId} */ (plan);
  return null;
}

/**
 * Permissoes efetivas por recurso (somente leitura, para a UI).
 * Considera planGateExempt; nao altera nenhuma regra de bloqueio da API.
 * @param {{ plan?: string|null, planGateExempt?: boolean|null, enableNfceEmission?: boolean|null }|null|undefined} tenant
 */
export function tenantEntitlements(tenant) {
  const features = {};
  for (const [feature, minPlan] of Object.entries(FEATURE_MIN_PLAN)) {
    features[feature] = tenantMeetsPlan(tenant, minPlan);
  }
  return {
    planGateExempt: Boolean(tenant?.planGateExempt),
    maxUsers: planMaxUsers(tenant),
    featureMinPlan: { ...FEATURE_MIN_PLAN },
    features
  };
}
