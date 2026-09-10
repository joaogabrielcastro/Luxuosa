import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { enqueueNfceIssue, processNfceQueue, resumeNfceQueuesOnStartup } from "../jobs/enqueueNfceIssue.js";
import {
  api,
  destroyTenant,
  prisma,
  registerTenant,
  seedCatalog,
  startTestServer
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

describe("nfce queue/worker integration", { skip: !runDb }, () => {
  /** @type {{ baseUrl: string, close: () => Promise<void> }} */
  let server;
  const tenantIds = [];

  before(async () => {
    assert.equal(process.env.NFCE_MOCK, "true");
    server = await startTestServer();
  });

  after(async () => {
    for (const id of tenantIds) {
      await destroyTenant(id);
    }
    await server.close();
  });

  it("enfileira, worker drena e marca job COMPLETED com NFC-e mock", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: {
        plan: "PRO",
        enableNfceEmission: true,
        notaasApiKey: "ntaas_mock_queue_key"
      }
    });

    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 4, price: 35 });
    const sale = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        paymentMethod: "PIX",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 35 }]
      }
    });
    assert.equal(sale.status, 201);

    await enqueueNfceIssue(session.tenantId, sale.data.id);
    const pending = await prisma.nfceIssueJob.findUnique({ where: { saleId: sale.data.id } });
    assert.equal(pending?.status, "PENDING");

    await processNfceQueue(session.tenantId);

    const done = await prisma.nfceIssueJob.findUnique({ where: { saleId: sale.data.id } });
    assert.equal(done?.status, "COMPLETED");

    const invoice = await prisma.invoice.findFirst({
      where: { tenantId: session.tenantId, saleId: sale.data.id }
    });
    assert.equal(invoice?.status, "ISSUED");
    assert.ok(invoice?.externalId?.startsWith("inv_mock_"));
  });

  it("loja sem NFC-e nao cria job; job existente vira FAILED", async () => {
    const session = await registerTenant(server.baseUrl);
    tenantIds.push(session.tenantId);
    const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 2, price: 20 });
    const sale = await api(server.baseUrl, "/sales", {
      method: "POST",
      token: session.token,
      body: {
        paymentMethod: "CASH",
        installments: 1,
        emitNfce: false,
        items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 20 }]
      }
    });
    assert.equal(sale.status, 201);

    await enqueueNfceIssue(session.tenantId, sale.data.id);
    assert.equal(await prisma.nfceIssueJob.findUnique({ where: { saleId: sale.data.id } }), null);

    await prisma.nfceIssueJob.create({
      data: { tenantId: session.tenantId, saleId: sale.data.id, status: "PENDING" }
    });
    await enqueueNfceIssue(session.tenantId, sale.data.id);
    const failed = await prisma.nfceIssueJob.findUnique({ where: { saleId: sale.data.id } });
    assert.equal(failed.status, "FAILED");

    await resumeNfceQueuesOnStartup();
  });
});
