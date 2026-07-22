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

describe("nfce mock integration", { skip: !runDb }, () => {
  /** @type {{ baseUrl: string, close: () => Promise<void> }} */
  let server;
  const tenantIds = [];

  before(async () => {
    assert.equal(process.env.NFCE_MOCK, "true", "setupEnv deve definir NFCE_MOCK=true");
    server = await startTestServer();
  });

  after(async () => {
    for (const id of tenantIds) {
      await destroyTenant(id);
    }
    await server.close();
  });

  it("emite Invoice ISSUED com NFCE_MOCK=true", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { plan: "PRO", enableNfceEmission: true }
    });

    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 5, price: 40 });
    const sale = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        paymentMethod: "PIX",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 40 }]
      }
    });
    assert.equal(sale.status, 201);

    const issue = await api(server.baseUrl, `/invoices/issue/${sale.data.id}`, {
      method: "POST",
      token: session.token
    });
    assert.equal(issue.status, 201, JSON.stringify(issue.data));
    assert.equal(issue.data.status, "ISSUED");
    assert.ok(issue.data.externalId?.startsWith("mock_"));
    assert.ok(issue.data.key);

    const invoice = await prisma.invoice.findFirst({
      where: { tenantId: session.tenantId, saleId: sale.data.id }
    });
    assert.equal(invoice?.status, "ISSUED");
  });
});
