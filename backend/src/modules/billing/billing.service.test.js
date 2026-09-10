import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";

const stripe = {
  prices: { list: async () => ({ data: [{ id: "price_pro" }] }) },
  customers: { create: async () => ({ id: "cus_1" }) },
  checkout: { sessions: { create: async () => ({ url: "https://pay.test/c", id: "cs_1" }) } },
  billingPortal: { sessions: { create: async () => ({ url: "https://pay.test/p" }) } },
  subscriptions: {
    list: async () => ({ data: [] }),
    retrieve: async (id) => ({
      id,
      status: "active",
      customer: "cus_1",
      current_period_end: 2000000000,
      metadata: { tenantId: "t1", plan: "PRO" },
      items: { data: [{ price: { lookup_key: "luxuosa_pro" } }] }
    }),
    update: async () => ({})
  }
};

const tenant = {
  id: "t1",
  name: "Loja",
  email: "loja@test.com",
  cnpj: "12345678000199",
  plan: "BASIC",
  planGateExempt: false,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripeSubscriptionStatus: null,
  planPeriodEnd: null,
  enableNfceEmission: false
};

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      tenant: {
        findUnique: async () => tenant,
        findFirst: async () => tenant,
        update: async ({ data }) => {
          Object.assign(tenant, data);
          return { ...tenant };
        }
      }
    }
  }
});

mock.module("../../shared/stripeClient.js", {
  namedExports: {
    isStripeConfigured: () => true,
    getStripe: () => stripe
  }
});

const { billingService } = await import("./billing.service.js");

describe("billingService", () => {
  before(() => {
    tenant.stripeCustomerId = null;
    tenant.plan = "BASIC";
  });

  it("getStatus e checkout", async () => {
    const status = await billingService.getStatus("t1");
    assert.equal(status.configured, true);
    assert.equal(status.currentPlan, "BASIC");

    const checkout = await billingService.createCheckoutSession("t1", "PRO");
    assert.equal(checkout.url, "https://pay.test/c");
    assert.ok(tenant.stripeCustomerId);
  });

  it("plano invalido e ja ativo", async () => {
    await assert.rejects(() => billingService.createCheckoutSession("t1", "BASIC"), /plano pago/);
    tenant.plan = "PRO";
    tenant.stripeSubscriptionStatus = "active";
    await assert.rejects(() => billingService.createCheckoutSession("t1", "PRO"), /ja esta ativo/);
    tenant.plan = "BASIC";
    tenant.stripeSubscriptionStatus = null;
  });

  it("portal, sync sem assinatura e webhook", async () => {
    tenant.stripeCustomerId = "cus_1";
    const portal = await billingService.createPortalSession("t1");
    assert.match(portal.url, /pay.test/);

    const synced = await billingService.syncFromStripe("t1");
    assert.equal(synced.currentPlan, "BASIC");

    const received = await billingService.handleWebhookEvent({ type: "ping" });
    assert.equal(received.received, true);

    await billingService.handleWebhookEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "t1",
          subscription: "sub_1",
          metadata: { tenantId: "t1", plan: "PRO" }
        }
      }
    });

    await billingService.handleWebhookEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          customer: "cus_1",
          metadata: { tenantId: "t1", plan: "PRO" },
          current_period_end: 2000000000
        }
      }
    });

    await billingService.handleWebhookEvent({
      type: "customer.subscription.deleted",
      data: {
        object: { id: "sub_1", status: "canceled", customer: "cus_1", metadata: {} }
      }
    });
  });
});
