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
    name: "Basico",
    description: "Catalogo, vendas, estoque manual e crediario.",
    priceLabel: "Gratis",
    amountCents: 0,
    features: ["Catalogo e variacoes", "Vendas e estoque", "Crediario", "1–2 usuarios (manual)"]
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    description: "Fiscal NFC-e, importacao de NF-e e alertas de estoque.",
    priceLabel: "R$ 97/mes",
    amountCents: 9700,
    features: [
      "Tudo do Basico",
      "Emissao NFC-e (quando habilitada na loja)",
      "Importacao de NF-e de entrada",
      "Relatorios e exportacao"
    ]
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Multi-loja, suporte prioritario e limites ampliados.",
    priceLabel: "R$ 250/mes",
    amountCents: 25000,
    features: ["Tudo do Pro", "Multi-loja (roadmap)", "Suporte prioritario", "Usuarios ampliados"]
  }
};

/** Features que exigem plano minimo.
 * @type {Record<string, PlanId>}
 */
export const FEATURE_MIN_PLAN = {
  nfeImport: "PRO",
  nfceEmission: "PRO",
  stockAlerts: "PRO",
  billingPortal: "BASIC"
};

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
 * @param {unknown} value
 * @returns {PlanId|null}
 */
export function normalizeStripePlan(value) {
  const plan = String(value || "").toUpperCase();
  if (plan === "PRO" || plan === "ENTERPRISE" || plan === "BASIC") return /** @type {PlanId} */ (plan);
  return null;
}
