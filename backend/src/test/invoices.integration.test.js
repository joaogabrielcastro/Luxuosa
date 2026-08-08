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

describe("invoices integration", { skip: !runDb }, () => {
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

  it("connection-test nao retorna 401/403 para admin", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    const res = await api(server.baseUrl, "/invoices/connection-test", {
      token: session.token
    });
    // Admin autenticado: nao e 401/403. Sem API Key Notaas retorna configured:false.
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });

  it("issue sem enableNfceEmission retorna erro; job 404 sem emissao", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { plan: "PRO", enableNfceEmission: false }
    });

    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 3, price: 40 });
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
    assert.ok(issue.status >= 400);
    assert.ok(
      issue.data?.code === "NFCE_TENANT_DISABLED" ||
        issue.status === 403 ||
        issue.status === 402 ||
        issue.status === 503
    );

    const job = await api(server.baseUrl, `/invoices/sale/${sale.data.id}/job`, {
      token: session.token
    });
    assert.equal(job.status, 404);
  });
});
