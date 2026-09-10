import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { InvoiceStatus } from "@prisma/client";
import { env } from "../../config/env.js";

const tenant = {
  id: "t1",
  name: "Loja",
  cnpj: "12345678000199",
  enableNfceEmission: true,
  notaasApiKey: "ntaas_testkey",
  notaasProjectId: "proj"
};

let invoiceRow = null;
let leaseCount = 1;
let saleRow = {
  id: "sale1",
  status: "PAID",
  paymentMethod: "PIX",
  discountValue: 0,
  totalValue: 40,
  items: [
    {
      quantity: 1,
      unitPrice: 40,
      productVariation: {
        product: { id: "p1", name: "Camisa", sku: "7891234567890", ncm: "61091000", cfop: "5102" }
      }
    }
  ],
  invoice: null
};

const notaas = {
  ping: async () => ({ ok: true, status: 200 }),
  post: async () => ({ ok: true, body: { invoiceId: "inv_1" } }),
  status: async () => ({ ok: true, body: { status: "issued", chave: "3524", numero: 1 } }),
  danfe: async () => ({ ok: true, status: 200, body: Buffer.from("%PDF") }),
  xml: async () => ({ ok: true, body: "<xml/>" })
};

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      tenant: {
        findUnique: async ({ where }) => (where.id === "missing" ? null : { ...tenant }),
        update: async ({ data }) => ({ ...tenant, ...data, notaasApiKey: data.notaasApiKey ?? tenant.notaasApiKey })
      },
      invoice: {
        findFirst: async () => invoiceRow,
        findUnique: async () => invoiceRow,
        upsert: async () => {
          invoiceRow = {
            tenantId: "t1",
            saleId: "sale1",
            status: InvoiceStatus.PENDING,
            ...(invoiceRow || {})
          };
          return invoiceRow;
        },
        updateMany: async ({ data }) => {
          if (data.emissionStartedAt && leaseCount === 0) return { count: 0 };
          if (invoiceRow) Object.assign(invoiceRow, data);
          return { count: invoiceRow ? 1 : 0 };
        }
      },
      nfceIssueJob: {
        findFirst: async () => ({ saleId: "sale1", status: "COMPLETED", attempts: 1 }),
        updateMany: async () => ({ count: 1 })
      }
    }
  }
});

mock.module("../../shared/notaas/notaasApi.js", {
  namedExports: {
    pingNotaasApiKey: (...a) => notaas.ping(...a),
    postNfeEmitir: (...a) => notaas.post(...a),
    getNfeStatus: (...a) => notaas.status(...a),
    getNfeDanfe: (...a) => notaas.danfe(...a),
    getNfeXml: (...a) => notaas.xml(...a)
  }
});

mock.module("../sales/sale.repository.js", {
  namedExports: {
    saleRepository: {
      findForNfe: async () => saleRow
    }
  }
});

const { invoiceService } = await import("./invoice.service.js");

describe("invoiceService", () => {
  it("connection-test caminhos", async () => {
    const prev = env.nfceMock;
    env.nfceMock = true;
    const data = await invoiceService.connectionTest("t1");
    assert.equal(data.provider, "notaas");
    await assert.rejects(() => invoiceService.connectionTest("missing"), /nao encontrada/);
    env.nfceMock = false;
    tenant.enableNfceEmission = false;
    tenant.cnpj = "123";
    tenant.notaasApiKey = "";
    const warned = await invoiceService.connectionTest("t1");
    assert.ok(warned.warnings.length >= 1);
    tenant.enableNfceEmission = true;
    tenant.cnpj = "12345678000199";
    tenant.notaasApiKey = "ntaas_testkey";
    notaas.ping = async () => ({ ok: false, status: 401 });
    const rejected = await invoiceService.connectionTest("t1");
    assert.ok(rejected.warnings.some((w) => /rejeitada/i.test(w)));
    notaas.ping = async () => ({ ok: true, status: 200 });
    env.nfceMock = prev;
  });

  it("atualiza config notaas e mascara chave", async () => {
    await assert.rejects(
      () => invoiceService.updateTenantNotaasConfig("t1", { notaasApiKey: "abc" }),
      /ntaas_/
    );
    const updated = await invoiceService.updateTenantNotaasConfig("t1", {
      notaasApiKey: "ntaas_abc",
      notaasProjectId: "p1",
      enableNfceEmission: true
    });
    assert.equal(updated.enableNfceEmission, true);
    const short = await invoiceService.updateTenantNotaasConfig("t1", { notaasApiKey: "ntaas_short" });
    assert.ok(short.notaasApiKeyMasked);
    await invoiceService.updateTenantNotaasConfig("t1", { notaasApiKey: null, notaasProjectId: "  " });
    await assert.rejects(() => invoiceService.updateTenantNotaasConfig("t1", {}), /Nada para atualizar/);
  });

  it("pdf 404 sem invoice e download ok", async () => {
    invoiceRow = null;
    await assert.rejects(() => invoiceService.fetchNfcePdfBuffer("t1", "sale1"), /nao encontrada/);
    invoiceRow = { externalId: "inv_1", number: "1", status: InvoiceStatus.ISSUED };
    const pdf = await invoiceService.fetchNfcePdfBuffer("t1", "sale1");
    assert.ok(pdf.buf.length);
    notaas.danfe = async () => ({ ok: false, status: 500 });
    await assert.rejects(() => invoiceService.fetchNfcePdfBuffer("t1", "sale1"), /DANFE/);
    notaas.danfe = async () => ({ ok: true, status: 200, body: Buffer.from("%PDF") });
  });

  it("issueFromSale erros e sucesso", async () => {
    const prev = env.nfceMock;
    env.nfceMock = true;
    tenant.enableNfceEmission = false;
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /nao habilitada/);
    assert.equal(await invoiceService.issueFromSale("t1", "sale1", { silent: true }), null);

    tenant.enableNfceEmission = true;
    tenant.notaasApiKey = "";
    env.nfceMock = false;
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /API Key/);
    assert.equal(await invoiceService.issueFromSale("t1", "sale1", { silent: true }), null);
    env.nfceMock = true;
    tenant.notaasApiKey = "ntaas_testkey";

    saleRow = null;
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /Venda nao encontrada/);
    saleRow = { id: "sale1", status: "CANCELED", items: [], invoice: null };
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /vendas pagas/);

    saleRow = {
      id: "sale1",
      status: "PAID",
      paymentMethod: "PIX",
      discountValue: 0,
      totalValue: 40,
      items: [
        {
          quantity: 1,
          unitPrice: 40,
          productVariation: { product: { id: "p1", name: "Camisa", sku: "7891234567890" } }
        }
      ],
      invoice: { status: InvoiceStatus.ISSUED, externalId: null }
    };
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /Ja existe NFC-e/);
    invoiceRow = { status: InvoiceStatus.ISSUED };
    assert.ok(await invoiceService.issueFromSale("t1", "sale1", { silent: true }));

    saleRow.invoice = { status: InvoiceStatus.ISSUED, externalId: "inv_old" };
    notaas.status = async () => ({ ok: true, body: { status: "issued" } });
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /Ja existe NFC-e/);

    notaas.status = async () => ({ ok: true, body: { status: "error", error: "rejeitada" } });
    invoiceRow = { tenantId: "t1", saleId: "sale1", status: InvoiceStatus.ISSUED, externalId: "inv_old" };
    leaseCount = 1;
    notaas.post = async () => ({ ok: true, body: { invoiceId: "inv_1" } });
    notaas.status = async () => ({ ok: true, body: { status: "issued", chaveAcesso: "k", numero: 9, pdfUrl: "/p" } });
    saleRow.invoice = { status: InvoiceStatus.ERROR, externalId: null };
    const issued = await invoiceService.issueFromSale("t1", "sale1");
    assert.ok(issued);

    leaseCount = 0;
    invoiceRow = { tenantId: "t1", saleId: "sale1", status: InvoiceStatus.PENDING };
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /andamento/);
    assert.equal(await invoiceService.issueFromSale("t1", "sale1", { silent: true }), null);
    leaseCount = 1;

    notaas.post = async () => ({ ok: false, body: { error: "nope" } });
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /rejeitou/);
    assert.equal(await invoiceService.issueFromSale("t1", "sale1", { silent: true }), null);

    notaas.post = async () => ({ ok: true, body: {} });
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /invoiceId/);

    notaas.post = async () => ({ ok: true, body: { invoiceId: "inv_1" } });
    notaas.status = async () => ({ ok: false, body: {} });
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /Falha ao consultar|Timeout|SEFAZ/);
    assert.equal(await invoiceService.issueFromSale("t1", "sale1", { silent: true }), null);

    notaas.status = async () => ({ ok: true, body: { status: "error", message: "sefaz" } });
    await assert.rejects(() => invoiceService.issueFromSale("t1", "sale1"), /sefaz/);

    notaas.status = async () => ({ ok: true, body: { status: "issued", chave: "k", numero: 1 } });
    notaas.xml = async () => {
      throw new Error("xml fail");
    };
    const ok = await invoiceService.issueFromSale("t1", "sale1");
    assert.ok(ok);

    const job = await invoiceService.getIssueJobStatus("t1", "sale1");
    assert.equal(job.saleId, "sale1");
    env.nfceMock = prev;
  });
});
