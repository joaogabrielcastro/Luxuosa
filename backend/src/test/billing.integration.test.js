import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { api, destroyTenant, registerTenant, startTestServer } from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("billing integration", { skip: !runDb }, () => {
  /** @type {{ baseUrl: string, close: () => Promise<void> }} */
  let server;
  const tenantIds = [];

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    for (const id of tenantIds) {
      await destroyTenant(id);
    }
    await server.close();
  });

  it("checkout plano invalido 400; portal sem customer 400; sync retorna status", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const { token } = session;

    const invalid = await api(server.baseUrl, "/billing/checkout", {
      method: "POST",
      token,
      body: { plan: "BASIC" }
    });
    assert.equal(invalid.status, 400);

    const portal = await api(server.baseUrl, "/billing/portal", {
      method: "POST",
      token
    });
    assert.equal(portal.status, 400);
    assert.ok(
      portal.data?.code === "NO_STRIPE_CUSTOMER" ||
        String(portal.data?.error || "").toLowerCase().includes("customer") ||
        String(portal.data?.error || "").toLowerCase().includes("stripe")
    );

    const sync = await api(server.baseUrl, "/billing/sync", {
      method: "POST",
      token
    });
    assert.equal(sync.status, 200);
    assert.ok(sync.data.currentPlan);
    assert.equal(typeof sync.data.configured, "boolean");
  });
});
