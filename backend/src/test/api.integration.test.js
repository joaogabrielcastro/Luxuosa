import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  prisma,
  registerTenant,
  seedCatalog,
  startTestServer,
  uniqueEmail,
  uniqueTestCnpj
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("API integration", { skip: !runDb }, () => {
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
    await prisma.$disconnect();
  });

  it("health responde ok", async () => {
    const res = await api(server.baseUrl, "/health");
    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
  });

  it("register + login + me", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    assert.ok(session.token);
    assert.equal(session.user.type, "ADMIN");
    assert.equal(session.tenant.plan, "BASIC");

    const login = await api(server.baseUrl, "/auth/login", {
      method: "POST",
      body: { email: session.adminEmail, password: session.adminPassword }
    });
    assert.equal(login.status, 200);
    assert.ok(login.data.token);

    const me = await api(server.baseUrl, "/auth/me", { token: session.token });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, session.adminEmail);
    assert.equal(me.data.tenant.id, session.tenantId);
  });

  it("login multi-loja exige tenantCnpj", async () => {
    const email = uniqueEmail("shared");
    const password = "senha123";
    const a = await registerTenant(server.baseUrl, {
      adminEmail: email,
      adminPassword: password,
      tenantEmail: uniqueEmail("loja-a")
    });
    tenantIds.push(a.tenantId);
    const b = await registerTenant(server.baseUrl, {
      adminEmail: email,
      adminPassword: password,
      tenantEmail: uniqueEmail("loja-b")
    });
    tenantIds.push(b.tenantId);

    const without = await api(server.baseUrl, "/auth/login", {
      method: "POST",
      body: { email, password }
    });
    assert.equal(without.status, 400);
    assert.equal(without.data.code, "TENANT_CNPJ_REQUIRED");

    const withCnpj = await api(server.baseUrl, "/auth/login", {
      method: "POST",
      body: { email, password, tenantCnpj: a.cnpj }
    });
    assert.equal(withCnpj.status, 200);
    assert.equal(withCnpj.data.tenant.id, a.tenantId);
  });

  it("admin cria atendente e atendente nao acessa users", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const attendantEmail = uniqueEmail("att");
    const created = await api(server.baseUrl, "/users", {
      method: "POST",
      token: session.token,
      body: {
        name: "Atendente",
        email: attendantEmail,
        password: "senha123",
        type: "ATTENDANT"
      }
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.type, "ATTENDANT");
    assert.equal(created.data.password, undefined);

    const attLogin = await api(server.baseUrl, "/auth/login", {
      method: "POST",
      body: { email: attendantEmail, password: "senha123" }
    });
    assert.equal(attLogin.status, 200);

    const forbidden = await api(server.baseUrl, "/users", { token: attLogin.data.token });
    assert.equal(forbidden.status, 403);
  });

  it("venda paga baixa estoque; cancelamento restaura", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 5, price: 40 });

    const sale = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        paymentMethod: "PIX",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 2, unitPrice: 40 }]
      }
    });
    assert.equal(sale.status, 201);
    assert.ok(sale.data.id);
    assert.equal(sale.data.status, "PAID");

    const variation = await prisma.productVariation.findFirst({
      where: { id: catalog.variationId, tenantId: session.tenantId }
    });
    assert.equal(variation.stock, 3);

    const cancel = await api(server.baseUrl, `/sales/${sale.data.id}/cancel`, {
      method: "POST",
      token: session.token
    });
    assert.equal(cancel.status, 200);

    const after = await prisma.productVariation.findFirst({
      where: { id: catalog.variationId, tenantId: session.tenantId }
    });
    assert.equal(after.stock, 5);
  });

  it("isolamento: tenant A nao le venda de tenant B", async () => {
    const a = await registerTenant(server.baseUrl);
    const b = await registerTenant(server.baseUrl);
    tenantIds.push(a.tenantId, b.tenantId);

    const catalogB = await seedCatalog(server.baseUrl, b.token, { stock: 3, price: 25 });
    const saleB = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: b.token,
      body: {
        paymentMethod: "CASH",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalogB.variationId, quantity: 1, unitPrice: 25 }]
      }
    });
    assert.equal(saleB.status, 201);

    const leak = await api(server.baseUrl, `/sales/${saleB.data.id}`, { token: a.token });
    assert.equal(leak.status, 404);
  });

  it("billing status e plan gating em import NF-e", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const status = await api(server.baseUrl, "/billing/status", { token: session.token });
    assert.equal(status.status, 200);
    assert.equal(status.data.currentPlan, "BASIC");
    assert.equal(typeof status.data.configured, "boolean");
    assert.equal(status.data.entitlements.nfeImport, false);

    const preview = await api(server.baseUrl, "/nfe-imports/preview", {
      method: "POST",
      token: session.token,
      body: { xml: "<nfe/>" }
    });
    assert.equal(preview.status, 402);
    assert.equal(preview.data.code, "PLAN_UPGRADE_REQUIRED");

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { plan: "PRO" }
    });

    const previewPro = await api(server.baseUrl, "/nfe-imports/preview", {
      method: "POST",
      token: session.token,
      body: { xml: "<nfe/>" }
    });
    assert.notEqual(previewPro.status, 402);
  });

  it("movimentacao manual de estoque ENTRY", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 1 });

    const move = await api(server.baseUrl, "/stock-movements", {
      method: "POST",
      token: session.token,
      body: {
        productVariationId: catalog.variationId,
        type: "ENTRY",
        quantity: 4
      }
    });
    assert.equal(move.status, 201);

    const variation = await prisma.productVariation.findFirst({
      where: { id: catalog.variationId, tenantId: session.tenantId }
    });
    assert.equal(variation.stock, 5);
  });

  it("CNPJ duplicado no register retorna conflito", async () => {
    const cnpj = uniqueTestCnpj();
    const first = await registerTenant(server.baseUrl, { cnpj });
    tenantIds.push(first.tenantId);

    const second = await api(server.baseUrl, "/auth/register", {
      method: "POST",
      body: {
        tenantName: "Outra",
        cnpj,
        tenantEmail: uniqueEmail("dup"),
        adminName: "Admin",
        adminEmail: uniqueEmail("dupadmin"),
        adminPassword: "senha123"
      }
    });
    assert.ok(second.status === 409 || second.status === 400);
  });
});
