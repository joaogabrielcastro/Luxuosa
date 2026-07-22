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

describe("cash integration", { skip: !runDb }, () => {
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

  it("abre e fecha caixa com totais de vendas PAID", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 10, price: 50 });

    const open = await api(server.baseUrl, "/cash/open", {
      method: "POST",
      token: session.token,
      body: { openingFloat: 100 }
    });
    assert.equal(open.status, 201);
    assert.equal(open.data.status, "OPEN");
    assert.equal(Number(open.data.openingFloat), 100);

    const saleCash = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        paymentMethod: "CASH",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 50 }]
      }
    });
    assert.equal(saleCash.status, 201);

    const salePix = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        paymentMethod: "PIX",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 50 }]
      }
    });
    assert.equal(salePix.status, 201);

    const current = await api(server.baseUrl, "/cash/current", { token: session.token });
    assert.equal(current.status, 200);
    assert.ok(current.data.session);
    assert.equal(current.data.preview.saleCount, 2);
    assert.equal(Number(current.data.preview.expectedCash), 50);

    const closed = await api(server.baseUrl, `/cash/${open.data.id}/close`, {
      method: "POST",
      token: session.token,
      body: { countedCash: 48, notes: "faltou 2" }
    });
    assert.equal(closed.status, 200);
    assert.equal(closed.data.status, "CLOSED");
    assert.equal(Number(closed.data.expectedCash), 50);
    assert.equal(Number(closed.data.countedCash), 48);
    assert.equal(Number(closed.data.differenceCash), -2);
    assert.equal(closed.data.saleCount, 2);

    const list = await api(server.baseUrl, "/cash", { token: session.token });
    assert.equal(list.status, 200);
    assert.ok((list.data.items || []).some((row) => row.id === open.data.id));
  });

  it("atendente nao abre caixa", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const attendantEmail = uniqueEmail("att-cash");
    const created = await api(server.baseUrl, "/users", {
      method: "POST",
      token: session.token,
      body: {
        name: "Atendente Caixa",
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

    const open = await api(server.baseUrl, "/cash/open", {
      method: "POST",
      token: login.data.token,
      body: { openingFloat: 10 }
    });
    assert.equal(open.status, 403);
  });
});
