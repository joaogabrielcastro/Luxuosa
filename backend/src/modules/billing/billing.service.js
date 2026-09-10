import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { getStripe, isStripeConfigured } from "../../shared/stripeClient.js";
import {
  PLAN_CATALOG,
  STRIPE_PLAN_LOOKUP_KEYS,
  tenantMeetsPlan,
  normalizeStripePlan
} from "../../shared/planCatalog.js";
import { planFromSubscription, subscriptionPeriodEnd } from "./billingPlan.js";

/**
 * @typedef {import("../../shared/planCatalog.js").PlanId} PlanId
 */

/**
 * @param {PlanId} plan
 * @returns {Promise<string|null>}
 */
async function resolvePriceId(plan) {
  const fromEnv =
    plan === "PRO" ? env.stripe.pricePro : plan === "ENTERPRISE" ? env.stripe.priceEnterprise : "";
  if (fromEnv) return fromEnv;

  const lookupKey = STRIPE_PLAN_LOOKUP_KEYS[plan];
  if (!lookupKey) return null;

  const stripe = getStripe();
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1
  });
  return prices.data[0]?.id || null;
}

async function ensureStripeCustomer(tenant) {
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: tenant.name,
    email: tenant.email || undefined,
    metadata: {
      tenantId: tenant.id,
      cnpj: tenant.cnpj
    }
  });

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { stripeCustomerId: customer.id }
  });

  return customer.id;
}

async function applySubscriptionToTenant(tenantId, subscription) {
  const status = subscription?.status || null;
  const active = status === "active" || status === "trialing" || status === "past_due";
  const plan = active ? planFromSubscription(subscription) : "BASIC";

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan,
      stripeSubscriptionId: subscription?.id || null,
      stripeSubscriptionStatus: status,
      planPeriodEnd: active ? subscriptionPeriodEnd(subscription) : null,
      ...(subscription?.customer
        ? { stripeCustomerId: String(subscription.customer) }
        : {})
    }
  });
}

export const billingService = {
  isConfigured: isStripeConfigured,

  async getStatus(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        plan: true,
        planGateExempt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        planPeriodEnd: true,
        enableNfceEmission: true
      }
    });
    if (!tenant) {
      const err = new Error("Loja nao encontrada.");
      err.statusCode = 404;
      throw err;
    }

    return {
      configured: isStripeConfigured(),
      currentPlan: tenant.plan,
      planGateExempt: Boolean(tenant.planGateExempt),
      subscriptionStatus: tenant.stripeSubscriptionStatus,
      planPeriodEnd: tenant.planPeriodEnd,
      hasStripeCustomer: Boolean(tenant.stripeCustomerId),
      entitlements: {
        nfeImport: tenantMeetsPlan(tenant, "PRO"),
        nfceEmission: tenantMeetsPlan(tenant, "PRO") && tenant.enableNfceEmission
      },
      plans: Object.values(PLAN_CATALOG).map((p) => ({
        ...p,
        current: p.id === tenant.plan,
        canCheckout: p.id !== "BASIC" && p.id !== tenant.plan
      }))
    };
  },

  async createCheckoutSession(tenantId, planInput) {
    const plan = normalizeStripePlan(planInput);
    if (!plan || plan === "BASIC") {
      const err = new Error("Informe um plano pago: PRO ou ENTERPRISE.");
      err.statusCode = 400;
      err.code = "INVALID_PLAN";
      throw err;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      const err = new Error("Loja nao encontrada.");
      err.statusCode = 404;
      throw err;
    }

    if (tenant.plan === plan && ["active", "trialing"].includes(tenant.stripeSubscriptionStatus || "")) {
      const err = new Error("Este plano ja esta ativo.");
      err.statusCode = 400;
      err.code = "PLAN_ALREADY_ACTIVE";
      throw err;
    }

    const priceId = await resolvePriceId(plan);
    if (!priceId) {
      const err = new Error(
        `Preco Stripe do plano ${plan} nao encontrado. Defina STRIPE_PRICE_${plan} ou rode npm run stripe:setup.`
      );
      err.statusCode = 503;
      err.code = "STRIPE_PRICE_MISSING";
      throw err;
    }

    const customerId = await ensureStripeCustomer(tenant);
    const stripe = getStripe();
    const base = env.stripe.frontendUrl.replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: tenantId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/assinatura?checkout=success`,
      cancel_url: `${base}/assinatura?checkout=cancel`,
      metadata: { tenantId, plan },
      subscription_data: {
        metadata: { tenantId, plan }
      },
      allow_promotion_codes: true
    });

    return { url: session.url, sessionId: session.id };
  },

  async createPortalSession(tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.stripeCustomerId) {
      const err = new Error("Nenhuma assinatura Stripe vinculada a esta loja.");
      err.statusCode = 400;
      err.code = "NO_STRIPE_CUSTOMER";
      throw err;
    }

    const stripe = getStripe();
    const base = env.stripe.frontendUrl.replace(/\/$/, "");
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${base}/assinatura`
    });
    return { url: session.url };
  },

  /** Sincroniza assinatura a partir do Stripe (util sem webhook em dev). */
  async syncFromStripe(tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.stripeCustomerId) {
      return this.getStatus(tenantId);
    }

    const stripe = getStripe();
    const list = await stripe.subscriptions.list({
      customer: tenant.stripeCustomerId,
      status: "all",
      limit: 5,
      expand: ["data.items.data.price"]
    });

    const preferred =
      list.data.find((s) => s.status === "active" || s.status === "trialing") ||
      list.data.find((s) => s.status === "past_due") ||
      list.data[0];

    if (!preferred) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          plan: "BASIC",
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: null,
          planPeriodEnd: null
        }
      });
      return this.getStatus(tenantId);
    }

    await applySubscriptionToTenant(tenantId, preferred);
    return this.getStatus(tenantId);
  },

  async handleWebhookEvent(event) {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const tenantId = session.client_reference_id || session.metadata?.tenantId;
        if (!tenantId || !session.subscription) break;

        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription), {
          expand: ["items.data.price"]
        });
        if (session.metadata?.plan && !subscription.metadata?.plan) {
          await stripe.subscriptions.update(subscription.id, {
            metadata: { ...subscription.metadata, tenantId, plan: session.metadata.plan }
          });
          subscription.metadata = {
            ...subscription.metadata,
            tenantId,
            plan: session.metadata.plan
          };
        }
        await applySubscriptionToTenant(tenantId, subscription);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
          await applySubscriptionToTenant(tenantId, subscription);
          break;
        }
        if (subscription.customer) {
          const tenant = await prisma.tenant.findFirst({
            where: { stripeCustomerId: String(subscription.customer) }
          });
          if (tenant) await applySubscriptionToTenant(tenant.id, subscription);
        }
        break;
      }
      default:
        break;
    }
    return { received: true };
  }
};
