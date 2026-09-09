import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  registerTenant,
  seedCatalog,
  startTestServer,
  uniqueEmail
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("dashboard integration", { skip: !runDb }, () => {
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

  it("GET /dashboard/admin como admin", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const res = await api(server.baseUrl, "/dashboard/admin?compact=1", {
      token: session.token
    });
    assert.equal(res.status, 200);
    assert.ok(res.data);
    assert.equal(typeof res.data.monthlyRevenue, "number");
    assert.equal(typeof res.data.crediarioOpenBalance, "number");
    assert.equal(typeof res.data.crediarioReceivedMonth, "number");
  });

  it("GET /dashboard/admin como atendente retorna 403", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const attendantEmail = uniqueEmail("att-dash");
    const created = await api(server.baseUrl, "/users", {
      method: "POST",
      token: session.token,
      body: {
        name: "Atendente Dash",
        email: attendantEmail,
        password: "senha123",
        type: "ATTENDANT"
      }
    });
    assert.equal(created.status, 201);

    const login = await api(server.baseUrl, "/auth/login", {
      method: "POST",
      body: { email: attendantEmail, password: "senha123" }
    });
    assert.equal(login.status, 200);

    const forbidden = await api(server.baseUrl, "/dashboard/admin", {
      token: login.data.token
    });
    assert.equal(forbidden.status, 403);
  });

  it("GET /dashboard/admin inclui recebimento de crediario no faturamento", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 10, price: 80 });

    const customer = await api(server.baseUrl, "/customers", {
      method: "POST",
      token: session.token,
      body: { name: `Dash Cred ${Date.now()}`, cpfCnpj: "11144477735" }
    });
    assert.equal(customer.status, 201);

    const created = await api(server.baseUrl, "/crediario", {
      method: "POST",
      token: session.token,
      body: {
        customerId: customer.data.id,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 80 }]
      }
    });
    assert.equal(created.status, 201);

    const openDash = await api(server.baseUrl, "/dashboard/admin?compact=1", {
      token: session.token
    });
    assert.equal(openDash.status, 200);
    assert.equal(openDash.data.crediarioOpenBalance, 80);
    assert.equal(openDash.data.crediarioOpenCount, 1);
    assert.equal(openDash.data.crediarioReceivedMonth, 0);
    assert.equal(openDash.data.monthlyRevenue, 0);
    assert.equal(openDash.data.daySales, 1);

    const payment = await api(server.baseUrl, `/crediario/${created.data.id}/payments`, {
      method: "POST",
      token: session.token,
      body: { amount: 80, paymentMethod: "dinheiro" }
    });
    assert.equal(payment.status, 200);

    const paidDash = await api(server.baseUrl, "/dashboard/admin?compact=1", {
      token: session.token
    });
    assert.equal(paidDash.status, 200);
    assert.equal(paidDash.data.crediarioOpenBalance, 0);
    assert.equal(paidDash.data.crediarioOpenCount, 0);
    assert.equal(paidDash.data.crediarioReceivedMonth, 80);
    assert.equal(paidDash.data.monthlyRevenue, 80);
  });
});
