import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  prisma,
  registerTenant,
  seedCatalog,
  startTestServer,
  uniqueEmail
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("sales integration", { skip: !runDb }, () => {
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

  it("list get update sale with customerId", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 10, price: 50 });

    const customer = await api(server.baseUrl, "/customers", {
      method: "POST",
      token: session.token,
      body: { name: `Cliente Venda ${Date.now()}`, cpfCnpj: "98765432100" }
    });
    assert.equal(customer.status, 201);

    const sale = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        customerId: customer.data.id,
        paymentMethod: "PIX",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 50 }]
      }
    });
    assert.equal(sale.status, 201);
    assert.equal(sale.data.customerId, customer.data.id);

    const list = await api(server.baseUrl, "/sales", { token: session.token });
    assert.equal(list.status, 200);
    const items = list.data.items || list.data;
    assert.ok(items.some((s) => s.id === sale.data.id));

    const get = await api(server.baseUrl, `/sales/${sale.data.id}`, { token: session.token });
    assert.equal(get.status, 200);
    assert.equal(get.data.id, sale.data.id);

    const updated = await api(server.baseUrl, `/sales/${sale.data.id}`, {
      method: "PUT",
      token: session.token,
      body: {
        customerId: customer.data.id,
        paymentMethod: "CASH",
        installments: 1,
        emitNfce: false,
        discountPercent: 5,
        items: [{ productVariationId: catalog.variationId, quantity: 2, unitPrice: 50 }]
      }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.paymentMethod, "CASH");
  });

  it("atendente com desconto acima de 10% recebe 403", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 5, price: 100 });

    const attendantEmail = uniqueEmail("att-disc");
    const created = await api(server.baseUrl, "/users", {
      method: "POST",
      token: session.token,
      body: {
        name: "Atendente Desc",
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

    const forbidden = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: login.data.token,
      body: {
        paymentMethod: "PIX",
        installments: 1,
        emitNfce: false,
        discountPercent: 15,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 100 }]
      }
    });
    assert.equal(forbidden.status, 403);
  });

  it("venda com quantidade maior que estoque falha", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 2, price: 30 });

    const oversell = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        paymentMethod: "CASH",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 5, unitPrice: 30 }]
      }
    });
    assert.equal(oversell.status, 400);

    const variation = await prisma.productVariation.findFirst({
      where: { id: catalog.variationId, tenantId: session.tenantId }
    });
    assert.equal(variation.stock, 2);
  });
});
