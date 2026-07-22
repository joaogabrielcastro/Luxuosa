import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  api,
  destroyTenant,
  prisma,
  registerTenant,
  seedCatalog,
  startTestServer
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("crediario integration", { skip: !runDb }, () => {
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

  it("cria venda a prazo, registra pagamento e cancela (sem pagamento)", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 10, price: 80 });

    const customer = await api(server.baseUrl, "/customers", {
      method: "POST",
      token: session.token,
      body: { name: `Cred Cliente ${Date.now()}`, cpfCnpj: "11144477735" }
    });
    assert.equal(customer.status, 201);

    const toCancel = await api(server.baseUrl, "/crediario", {
      method: "POST",
      token: session.token,
      body: {
        customerId: customer.data.id,
        notes: "cancelavel",
        items: [{ productVariationId: catalog.variationId, quantity: 2, unitPrice: 80 }]
      }
    });
    assert.equal(toCancel.status, 201);

    const cancel = await api(server.baseUrl, `/crediario/${toCancel.data.id}/cancel`, {
      method: "POST",
      token: session.token
    });
    assert.equal(cancel.status, 200);

    const restored = await prisma.productVariation.findFirst({
      where: { id: catalog.variationId, tenantId: session.tenantId }
    });
    assert.equal(restored.stock, 10);

    const toPay = await api(server.baseUrl, "/crediario", {
      method: "POST",
      token: session.token,
      body: {
        customerId: customer.data.id,
        notes: "com pagamento",
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 80 }]
      }
    });
    assert.equal(toPay.status, 201);

    const payment = await api(server.baseUrl, `/crediario/${toPay.data.id}/payments`, {
      method: "POST",
      token: session.token,
      body: { amount: 30, paymentMethod: "pix", note: "parcela 1" }
    });
    assert.equal(payment.status, 200);
  });
});
