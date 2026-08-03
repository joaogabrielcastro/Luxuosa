import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  clearMockNfceEmissions,
  getMockNfceEmissions
} from "../shared/nuvemFiscal/nuvemFiscalApi.js";
import {
  api,
  destroyTenant,
  prisma,
  registerTenant,
  seedCatalog,
  startTestServer,
  uniqueTestCnpj
} from "./helpers.js";

const runDb = Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_TESTS !== "1";

async function enableNfcePro(tenantId) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: "PRO", enableNfceEmission: true }
  });
}

async function createPaidSale(baseUrl, token, catalog) {
  const sale = await api(baseUrl, "/sales", {
    method: "POST",
    token,
    body: {
      paymentMethod: "PIX",
      installments: 1,
      emitNfce: false,
      items: [{ productVariationId: catalog.variationId, quantity: 1, unitPrice: 40 }]
    }
  });
  assert.equal(sale.status, 201, JSON.stringify(sale.data));
  return sale.data;
}

describe("nfce multi-tenant isolation", { skip: !runDb }, () => {
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

  it("dois tenants emitem com CNPJs distintos e nao acessam nota um do outro", async () => {
    clearMockNfceEmissions();

    const cnpjA = uniqueTestCnpj();
    const cnpjB = uniqueTestCnpj();
    assert.notEqual(cnpjA, cnpjB);

    const a = await registerTenant(server.baseUrl, {
      cnpj: cnpjA,
      tenantName: `Loja A ${cnpjA.slice(-4)}`
    });
    const b = await registerTenant(server.baseUrl, {
      cnpj: cnpjB,
      tenantName: `Loja B ${cnpjB.slice(-4)}`
    });
    tenantIds.push(a.tenantId, b.tenantId);

    await enableNfcePro(a.tenantId);
    await enableNfcePro(b.tenantId);

    const catalogA = await seedCatalog(server.baseUrl, a.token, { stock: 5, price: 40 });
    const catalogB = await seedCatalog(server.baseUrl, b.token, { stock: 5, price: 40 });

    const saleA = await createPaidSale(server.baseUrl, a.token, catalogA);
    const saleB = await createPaidSale(server.baseUrl, b.token, catalogB);

    const issueA = await api(server.baseUrl, `/invoices/issue/${saleA.id}`, {
      method: "POST",
      token: a.token
    });
    assert.equal(issueA.status, 201, JSON.stringify(issueA.data));
    assert.equal(issueA.data.status, "ISSUED");

    const issueB = await api(server.baseUrl, `/invoices/issue/${saleB.id}`, {
      method: "POST",
      token: b.token
    });
    assert.equal(issueB.status, 201, JSON.stringify(issueB.data));
    assert.equal(issueB.data.status, "ISSUED");

    const emissions = getMockNfceEmissions();
    assert.equal(emissions.length, 2);
    assert.equal(emissions[0].emitCnpj, cnpjA);
    assert.equal(emissions[1].emitCnpj, cnpjB);
    assert.equal(emissions[0].referencia, saleA.id);
    assert.equal(emissions[1].referencia, saleB.id);

    const invA = await prisma.invoice.findFirst({
      where: { tenantId: a.tenantId, saleId: saleA.id }
    });
    const invB = await prisma.invoice.findFirst({
      where: { tenantId: b.tenantId, saleId: saleB.id }
    });
    assert.equal(invA?.status, "ISSUED");
    assert.equal(invB?.status, "ISSUED");
    assert.notEqual(invA?.id, invB?.id);

    // Isolamento HTTP: A nao le job/invoice da venda de B
    const leakJob = await api(server.baseUrl, `/invoices/sale/${saleB.id}/job`, {
      token: a.token
    });
    assert.ok(leakJob.status === 404 || leakJob.status === 403, JSON.stringify(leakJob.data));

    const leakPdf = await api(server.baseUrl, `/invoices/sale/${saleB.id}/pdf`, {
      token: a.token
    });
    assert.ok(leakPdf.status === 404 || leakPdf.status === 403 || leakPdf.status === 400);

    // B nao le venda/invoice de A via prisma scope no endpoint
    const leakJobB = await api(server.baseUrl, `/invoices/sale/${saleA.id}/job`, {
      token: b.token
    });
    assert.ok(leakJobB.status === 404 || leakJobB.status === 403);
  });

  it("tenant com CNPJ invalido nao emite mesmo com NUVEM_FISCAL_EMITENTE_CNPJ no processo", async () => {
    const { env } = await import("../config/env.js");
    const prev = env.nuvemFiscal.emitenteCnpj;
    env.nuvemFiscal.emitenteCnpj = "12440489000100";

    try {
      const session = await registerTenant(server.baseUrl, {
        cnpj: uniqueTestCnpj()
      });
      tenantIds.push(session.tenantId);

      // Forca CNPJ invalido apos o register (register exige 14 digitos)
      await prisma.tenant.update({
        where: { id: session.tenantId },
        data: { cnpj: `BAD${Date.now()}`.slice(0, 12), plan: "PRO", enableNfceEmission: true }
      });

      const catalog = await seedCatalog(server.baseUrl, session.token, { stock: 3, price: 20 });
      const sale = await createPaidSale(server.baseUrl, session.token, catalog);

      clearMockNfceEmissions();
      const issue = await api(server.baseUrl, `/invoices/issue/${sale.id}`, {
        method: "POST",
        token: session.token
      });
      assert.equal(issue.status, 400, JSON.stringify(issue.data));
      assert.equal(issue.data?.code, "NFCE_TENANT_CNPJ_REQUIRED");
      assert.equal(getMockNfceEmissions().length, 0);
    } finally {
      env.nuvemFiscal.emitenteCnpj = prev;
    }
  });
});
