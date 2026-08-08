import { InvoiceStatus, NfceIssueJobStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { postNfeEmitir, getNfeStatus, getNfeDanfe, pingNotaasApiKey } from "../../shared/notaas/notaasApi.js";
import { buildNotaasNfcePayload, digitsOnly } from "../../shared/notaas/notaasNfceBuilder.js";
import {
  formatCnpjBr,
  resolveEmitenteCnpj,
  requireTenantEmitenteCnpj
} from "../../shared/nuvemFiscal/nuvemFiscalEmitente.js";
import { saleRepository } from "../sales/sale.repository.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const EMISSION_LEASE_MS = 120000;

async function acquireEmissionLease(tenantId, saleId, { silent }) {
  const cutoff = new Date(Date.now() - EMISSION_LEASE_MS);
  const r = await prisma.invoice.updateMany({
    where: {
      tenantId,
      saleId,
      OR: [{ emissionStartedAt: null }, { emissionStartedAt: { lt: cutoff } }]
    },
    data: { emissionStartedAt: new Date() }
  });
  if (r.count > 0) return true;

  const inv = await prisma.invoice.findFirst({ where: { tenantId, saleId } });
  if (inv?.status === InvoiceStatus.ISSUED) {
    const err = new Error("Ja existe NFC-e emitida para esta venda.");
    err.statusCode = 409;
    throw err;
  }
  if (silent) return false;
  const err = new Error("Emissao de NFC-e em andamento. Aguarde ou tente novamente em instantes.");
  err.statusCode = 409;
  err.code = "NFCE_EMISSION_IN_PROGRESS";
  throw err;
}

async function releaseEmissionLease(tenantId, saleId) {
  await prisma.invoice.updateMany({
    where: { tenantId, saleId },
    data: { emissionStartedAt: null }
  });
}

async function ensureInvoiceRow(tenantId, saleId) {
  const existing = await prisma.invoice.findUnique({ where: { saleId } });
  if (existing && existing.tenantId !== tenantId) {
    const err = new Error("Invoice pertence a outra loja.");
    err.statusCode = 403;
    err.code = "NFCE_INVOICE_TENANT_MISMATCH";
    throw err;
  }
  return prisma.invoice.upsert({
    where: { saleId },
    create: { tenantId, saleId, status: InvoiceStatus.PENDING },
    update: {
      status: InvoiceStatus.PENDING,
      lastError: null,
      externalId: null,
      key: null,
      number: null,
      pdfUrl: null,
      xmlUrl: null,
      issuedAt: null
    }
  });
}

async function updateInvoiceForTenant(tenantId, saleId, data) {
  const r = await prisma.invoice.updateMany({
    where: { tenantId, saleId },
    data
  });
  if (r.count === 0) {
    const err = new Error("Invoice nao encontrada para esta loja.");
    err.statusCode = 404;
    throw err;
  }
}

async function pollNotaasStatus(apiKey, invoiceId) {
  const max = 60;
  for (let i = 0; i < max; i += 1) {
    const { ok, body } = await getNfeStatus(apiKey, invoiceId);
    if (!ok) {
      return { error: "Falha ao consultar NFC-e no Notaas.", body };
    }
    const st = String(body?.status || "").toLowerCase();
    if (st === "issued" || st === "error" || st === "cancelled" || st === "inutilized") {
      return { body };
    }
    await sleep(2000);
  }
  return { error: "Timeout aguardando processamento na SEFAZ (Notaas)." };
}

function requireTenantNotaasApiKey(tenant, { silent }) {
  const key = String(tenant?.notaasApiKey || "").trim();
  if (env.nfceMock) {
    return key || "ntaas_mock_key";
  }
  if (!key || !key.startsWith("ntaas_")) {
    if (silent) return null;
    const err = new Error(
      "API Key Notaas nao configurada nesta loja. Cadastre o projeto no Notaas e grave Tenant.notaasApiKey (ntaas_...)."
    );
    err.statusCode = 503;
    err.code = "NOTAAS_API_KEY_MISSING";
    throw err;
  }
  return key;
}

/**
 * Valida CNPJ da loja + API Key Notaas do tenant.
 */
async function connectionTest(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      cnpj: true,
      enableNfceEmission: true,
      notaasApiKey: true,
      notaasProjectId: true
    }
  });
  if (!tenant) {
    const err = new Error("Loja nao encontrada.");
    err.statusCode = 404;
    throw err;
  }

  const resolved = resolveEmitenteCnpj(tenant.cnpj);
  const warnings = [];
  const hasKey = Boolean(String(tenant.notaasApiKey || "").trim());

  if (resolved.source === "invalid") {
    warnings.push("CNPJ da loja no cadastro e invalido (precisa de 14 digitos).");
  }
  if (!tenant.enableNfceEmission) {
    warnings.push("NFC-e desligada para esta loja (enableNfceEmission).");
  }
  if (!hasKey && !env.nfceMock) {
    warnings.push(
      "Tenant.notaasApiKey ausente. Crie o projeto da loja no Notaas (mesmo CNPJ), configure certificado/CSC e cole a API Key ntaas_..."
    );
  }

  let keyOk = false;
  if (hasKey || env.nfceMock) {
    const apiKey = requireTenantNotaasApiKey(tenant, { silent: false });
    const ping = await pingNotaasApiKey(apiKey);
    keyOk = ping.ok;
    if (!ping.ok) {
      warnings.push(`API Key Notaas rejeitada (${ping.status}). Gere outra key no projeto da loja.`);
    }
  }

  const ok = resolved.emitCnpj.length === 14 && (keyOk || env.nfceMock) && tenant.enableNfceEmission;

  return {
    ok,
    provider: "notaas",
    environment: env.notaas.ambiente === "producao" ? "producao" : "homologacao",
    apiBase: env.notaas.apiBase,
    tenant: {
      name: tenant.name,
      cnpj: digitsOnly(tenant.cnpj),
      cnpjFormatado: formatCnpjBr(tenant.cnpj),
      enableNfceEmission: tenant.enableNfceEmission,
      notaasProjectId: tenant.notaasProjectId || null,
      hasNotaasApiKey: hasKey || env.nfceMock
    },
    emitente: {
      cnpj: resolved.emitCnpj,
      cnpjFormatado: formatCnpjBr(resolved.emitCnpj),
      source: resolved.source
    },
    warnings
  };
}

/**
 * Emite NFC-e (modelo 65) via Notaas e grava Invoice.
 * @param {boolean} [opts.silent]
 */
async function issueFromSale(tenantId, saleId, opts = {}) {
  const silent = opts.silent === true;

  const tenantPolicy = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      enableNfceEmission: true,
      cnpj: true,
      notaasApiKey: true,
      notaasProjectId: true
    }
  });
  if (!tenantPolicy?.enableNfceEmission) {
    if (silent) return null;
    const err = new Error(
      "Emissao de NFC-e nao habilitada para esta loja. Configure o Notaas (projeto + API Key) ou use venda sem nota."
    );
    err.statusCode = 403;
    err.code = "NFCE_TENANT_DISABLED";
    throw err;
  }

  const apiKey = requireTenantNotaasApiKey(tenantPolicy, { silent });
  if (!apiKey) return null;

  const sale = await saleRepository.findForNfe(tenantId, saleId);
  if (!sale) {
    const err = new Error("Venda nao encontrada.");
    err.statusCode = 404;
    throw err;
  }
  if (sale.status !== "PAID") {
    const err = new Error("Apenas vendas pagas podem gerar NFC-e.");
    err.statusCode = 400;
    throw err;
  }

  if (sale.invoice?.status === InvoiceStatus.ISSUED) {
    const invoiceRef = sale.invoice.externalId;
    if (!invoiceRef) {
      if (silent) return prisma.invoice.findFirst({ where: { tenantId, saleId } });
      const err = new Error("Ja existe NFC-e emitida para esta venda.");
      err.statusCode = 409;
      throw err;
    }

    const remote = await getNfeStatus(apiKey, invoiceRef);
    if (remote.ok && String(remote.body?.status).toLowerCase() === "issued") {
      if (silent) return prisma.invoice.findFirst({ where: { tenantId, saleId } });
      const err = new Error("Ja existe NFC-e emitida para esta venda.");
      err.statusCode = 409;
      throw err;
    }

    const motivo =
      remote.body?.error ||
      remote.body?.message ||
      "NFC-e nao autorizada no Notaas. Reemissao liberada.";
    await updateInvoiceForTenant(tenantId, saleId, {
      status: InvoiceStatus.ERROR,
      lastError: String(motivo).slice(0, 65000),
      externalId: null,
      key: null,
      number: null,
      pdfUrl: null,
      issuedAt: null
    });
  }

  requireTenantEmitenteCnpj(tenantPolicy.cnpj);

  const payload = buildNotaasNfcePayload({ sale });

  await ensureInvoiceRow(tenantId, saleId);

  const gotLease = await acquireEmissionLease(tenantId, saleId, { silent });
  if (!gotLease) {
    return null;
  }

  try {
    const postRes = await postNfeEmitir(apiKey, payload);
    if (!postRes.ok) {
      const msg = JSON.stringify(postRes.body);
      await updateInvoiceForTenant(tenantId, saleId, {
        status: InvoiceStatus.ERROR,
        lastError: msg.slice(0, 65000)
      });
      const err = new Error("Notaas rejeitou a emissao da NFC-e.");
      err.statusCode = 502;
      err.details = postRes.body;
      if (silent) return null;
      throw err;
    }

    const docId = postRes.body?.invoiceId || postRes.body?.id;
    if (!docId) {
      const err = new Error("Resposta Notaas sem invoiceId.");
      err.statusCode = 502;
      throw err;
    }

    await updateInvoiceForTenant(tenantId, saleId, { externalId: String(docId) });

    const polled = await pollNotaasStatus(apiKey, String(docId));
    if (polled.error) {
      await updateInvoiceForTenant(tenantId, saleId, {
        status: InvoiceStatus.ERROR,
        lastError: polled.error
      });
      const err = new Error(polled.error);
      err.statusCode = 504;
      if (silent) return null;
      throw err;
    }

    const final = polled.body;
    const st = String(final?.status || "").toLowerCase();
    const chave = final?.chaveAcesso || final?.chave || null;
    const numero = final?.numero != null ? String(final.numero) : null;

    if (st !== "issued") {
      const motivo =
        final?.error ||
        final?.message ||
        final?.motivo ||
        JSON.stringify(final).slice(0, 2000);
      await updateInvoiceForTenant(tenantId, saleId, {
        status: InvoiceStatus.ERROR,
        lastError: String(motivo).slice(0, 65000)
      });
      const err = new Error(String(motivo));
      err.statusCode = 502;
      err.details = final;
      if (silent) return null;
      throw err;
    }

    await updateInvoiceForTenant(tenantId, saleId, {
      status: InvoiceStatus.ISSUED,
      key: chave,
      number: numero,
      issuedAt: new Date(),
      lastError: null,
      pdfUrl: final?.pdfUrl || `/nfe/invoices/${encodeURIComponent(docId)}/danfe`,
      emissionStartedAt: null
    });

    await prisma.nfceIssueJob.updateMany({
      where: { tenantId, saleId },
      data: {
        status: NfceIssueJobStatus.COMPLETED,
        lastError: null,
        runAt: null
      }
    });

    return prisma.invoice.findFirst({ where: { tenantId, saleId } });
  } finally {
    await releaseEmissionLease(tenantId, saleId);
  }
}

async function fetchNfcePdfBuffer(tenantId, saleId) {
  const invoice = await prisma.invoice.findFirst({
    where: { tenantId, saleId, status: InvoiceStatus.ISSUED }
  });
  if (!invoice?.externalId) {
    const err = new Error("NFC-e nao encontrada ou ainda nao autorizada.");
    err.statusCode = 404;
    throw err;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { notaasApiKey: true }
  });
  const apiKey = requireTenantNotaasApiKey(tenant, { silent: false });

  let res;
  let lastStatus = 404;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    res = await getNfeDanfe(apiKey, invoice.externalId);
    if (res.ok) break;
    lastStatus = res.status;
    if (res.status !== 404 || attempt === 6) break;
    await sleep(1500);
  }

  if (!res?.ok) {
    const err = new Error(`Notaas retornou ${lastStatus} ao baixar DANFE.`);
    err.statusCode = 502;
    throw err;
  }

  const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body || []);
  return { buf, filename: `nfce-${invoice.number || saleId}.pdf` };
}

function maskNotaasApiKey(key) {
  const k = String(key || "").trim();
  if (!k) return null;
  if (k.length <= 12) return `${k.slice(0, 4)}…`;
  return `${k.slice(0, 10)}…${k.slice(-4)}`;
}

/**
 * Admin: grava API Key / project id Notaas da loja (multi-tenant).
 */
async function updateTenantNotaasConfig(tenantId, { notaasApiKey, notaasProjectId, enableNfceEmission }) {
  const data = {};
  if (notaasApiKey !== undefined) {
    const key = notaasApiKey == null ? null : String(notaasApiKey).trim();
    if (key && !key.startsWith("ntaas_")) {
      const err = new Error("notaasApiKey deve comecar com ntaas_.");
      err.statusCode = 400;
      throw err;
    }
    data.notaasApiKey = key || null;
  }
  if (notaasProjectId !== undefined) {
    data.notaasProjectId = notaasProjectId == null ? null : String(notaasProjectId).trim() || null;
  }
  if (enableNfceEmission !== undefined) {
    data.enableNfceEmission = Boolean(enableNfceEmission);
  }
  if (!Object.keys(data).length) {
    const err = new Error("Nada para atualizar.");
    err.statusCode = 400;
    throw err;
  }
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data,
    select: {
      id: true,
      name: true,
      cnpj: true,
      enableNfceEmission: true,
      notaasProjectId: true,
      notaasApiKey: true
    }
  });
  return {
    id: updated.id,
    name: updated.name,
    cnpj: updated.cnpj,
    enableNfceEmission: updated.enableNfceEmission,
    notaasProjectId: updated.notaasProjectId,
    hasNotaasApiKey: Boolean(String(updated.notaasApiKey || "").trim()),
    notaasApiKeyMasked: maskNotaasApiKey(updated.notaasApiKey)
  };
}

export const invoiceService = {
  connectionTest,
  issueFromSale,
  fetchNfcePdfBuffer,
  updateTenantNotaasConfig,
  async getIssueJobStatus(tenantId, saleId) {
    return prisma.nfceIssueJob.findFirst({
      where: { tenantId, saleId },
      select: {
        saleId: true,
        status: true,
        attempts: true,
        runAt: true,
        updatedAt: true,
        lastError: true
      }
    });
  }
};
