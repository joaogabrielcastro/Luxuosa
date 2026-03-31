import { InvoiceStatus, NfceIssueJobStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { getNuvemFiscalAccessToken } from "../../shared/nuvemFiscal/nuvemFiscalAuth.js";
import {
  getEmpresa,
  getEmpresaNfceConfig,
  postNfce,
  getNfceById
} from "../../shared/nuvemFiscal/nuvemFiscalApi.js";
import { buildNfceRequestBody, digitsOnly } from "../../shared/nuvemFiscal/nuvemFiscalNfceBuilder.js";
import { saleRepository } from "../sales/sale.repository.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getEmitenteCnpj(tenantCnpj) {
  const fromEnv = env.nuvemFiscal.emitenteCnpj;
  if (fromEnv && digitsOnly(fromEnv).length === 14) return digitsOnly(fromEnv);
  return digitsOnly(tenantCnpj);
}

function normalizeEmpresaResponse(body) {
  if (!body) return null;
  if (body.nome_razao_social) return body;
  if (Array.isArray(body.data) && body.data[0]) return body.data[0];
  return body;
}

const EMISSION_LEASE_MS = 120000;

async function acquireEmissionLease(saleId, { silent }) {
  const cutoff = new Date(Date.now() - EMISSION_LEASE_MS);
  const r = await prisma.invoice.updateMany({
    where: {
      saleId,
      OR: [{ emissionStartedAt: null }, { emissionStartedAt: { lt: cutoff } }]
    },
    data: { emissionStartedAt: new Date() }
  });
  if (r.count > 0) return true;

  const inv = await prisma.invoice.findUnique({ where: { saleId } });
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

async function releaseEmissionLease(saleId) {
  await prisma.invoice.updateMany({
    where: { saleId },
    data: { emissionStartedAt: null }
  });
}

async function ensureInvoiceRow(tenantId, saleId) {
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

async function pollNfceStatus(nf, docId) {
  const max = 60;
  for (let i = 0; i < max; i += 1) {
    const { ok, body } = await getNfceById(nf, docId);
    if (!ok) {
      return { error: "Falha ao consultar NFC-e na Nuvem Fiscal.", body };
    }
    const st = body?.status;
    if (st !== "pendente" && st !== "processando") {
      return { body };
    }
    await sleep(2000);
  }
  return { error: "Timeout aguardando processamento na SEFAZ." };
}

/**
 * Valida Client ID / Secret: obtém token OAuth e lista empresas cadastradas na conta Nuvem Fiscal.
 */
async function connectionTest() {
  const nf = env.nuvemFiscal;
  if (!nf.clientId || !nf.clientSecret) {
    const err = new Error(
      "Nuvem Fiscal nao configurado. Defina NUVEM_FISCAL_CLIENT_ID e NUVEM_FISCAL_CLIENT_SECRET."
    );
    err.statusCode = 503;
    throw err;
  }

  const token = await getNuvemFiscalAccessToken(nf);
  const res = await fetch(`${nf.apiBase}/empresas`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`Nuvem Fiscal API retornou ${res.status}.`);
    err.statusCode = 502;
    err.details = body;
    throw err;
  }

  return {
    provider: "nuvemfiscal",
    environment: nf.apiBase.includes("sandbox") ? "sandbox" : "producao",
    empresas: body,
    doc: "NFC-e modelo 65 apos venda (POST /nfce). OAuth com scope empresa nfe nfce."
  };
}

/**
 * Emite NFC-e (modelo 65) via Nuvem Fiscal e grava Invoice.
 * @param {boolean} [opts.silent] — se true, nao lanca quando credenciais ausentes (emissao automatica pos-venda).
 */
async function issueFromSale(tenantId, saleId, opts = {}) {
  const silent = opts.silent === true;
  const nf = env.nuvemFiscal;

  if (!nf.clientId || !nf.clientSecret) {
    if (silent) return null;
    const err = new Error("Nuvem Fiscal nao configurado.");
    err.statusCode = 503;
    throw err;
  }

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
    const invoiceRef = sale.invoice.externalId || sale.invoice.key;
    if (!invoiceRef) {
      if (silent) return prisma.invoice.findUnique({ where: { saleId } });
      const err = new Error("Ja existe NFC-e emitida para esta venda.");
      err.statusCode = 409;
      throw err;
    }

    const remote = await getNfceById(nf, invoiceRef);
    if (!remote.ok) {
      if (silent) return null;
      const err = new Error("Ja existe NFC-e emitida para esta venda.");
      err.statusCode = 409;
      throw err;
    }

    const codigo = remote.body?.autorizacao?.codigo_status;
    const autorizada = codigo === 100 || codigo === 150;
    if (autorizada) {
      if (silent) return prisma.invoice.findUnique({ where: { saleId } });
      const err = new Error("Ja existe NFC-e emitida para esta venda.");
      err.statusCode = 409;
      throw err;
    }

    // Estado local ficou ISSUED, mas na Nuvem a nota nao esta autorizada (rejeitada/cancelada).
    // Reabre a invoice para permitir nova emissao.
    const motivo =
      remote.body?.autorizacao?.motivo_status ||
      "NFC-e nao autorizada na Nuvem Fiscal. Reemissao liberada.";
    await prisma.invoice.update({
      where: { saleId },
      data: {
        status: InvoiceStatus.ERROR,
        lastError: String(motivo).slice(0, 65000),
        externalId: null,
        key: null,
        number: null,
        pdfUrl: null,
        issuedAt: null
      }
    });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const emitCnpj = getEmitenteCnpj(tenant.cnpj);

  if (emitCnpj.length !== 14) {
    const err = new Error("CNPJ do emitente invalido (tenant ou NUVEM_FISCAL_EMITENTE_CNPJ).");
    err.statusCode = 400;
    throw err;
  }

  const ambiente = nf.ambiente === "producao" ? "producao" : "homologacao";

  const empRes = await getEmpresa(nf, emitCnpj);
  if (!empRes.ok) {
    const err = new Error(`Nuvem Fiscal: empresa ${emitCnpj} nao encontrada ou sem acesso.`);
    err.statusCode = 502;
    err.details = empRes.body;
    throw err;
  }
  const empresa = normalizeEmpresaResponse(empRes.body);
  if (!empresa?.endereco) {
    const err = new Error("Resposta Nuvem Fiscal sem dados de endereco do emitente.");
    err.statusCode = 502;
    throw err;
  }

  const nfceCfgRes = await getEmpresaNfceConfig(nf, emitCnpj);
  const empresaNfce = nfceCfgRes.ok ? nfceCfgRes.body : null;

  if (empresaNfce?.ambiente && empresaNfce.ambiente !== ambiente) {
    const err = new Error(
      `Ambiente Nuvem da empresa (${empresaNfce.ambiente}) difere de NUVEM_FISCAL_AMBIENTE (${ambiente}). Ajuste no console ou no .env.`
    );
    err.statusCode = 409;
    throw err;
  }

  const respTecCnpj = digitsOnly(nf.respTecCnpj);
  const respTecFone = digitsOnly(nf.respTecFone);
  const respTecEmail = String(nf.respTecEmail || "").trim();
  const respTecContato = String(nf.respTecContato || "").trim();
  const infRespTec =
    respTecCnpj.length === 14 && respTecEmail
      ? {
          CNPJ: respTecCnpj,
          xContato: respTecContato || "Suporte Luxuosa",
          email: respTecEmail,
          ...(respTecFone ? { fone: respTecFone } : {})
        }
      : null;

  const payload = buildNfceRequestBody({
    sale,
    empresa,
    empresaNfce: { ...(empresaNfce || {}), ...(infRespTec ? { respTec: infRespTec } : {}) },
    ambiente,
    referencia: sale.id
  });

  await ensureInvoiceRow(tenantId, saleId);

  const gotLease = await acquireEmissionLease(saleId, { silent });
  if (!gotLease) {
    return null;
  }

  try {
    const postRes = await postNfce(nf, payload);
    if (!postRes.ok) {
      const msg = JSON.stringify(postRes.body);
      await prisma.invoice.update({
        where: { saleId },
        data: { status: InvoiceStatus.ERROR, lastError: msg.slice(0, 65000) }
      });
      const err = new Error("Nuvem Fiscal rejeitou a emissao da NFC-e.");
      err.statusCode = 502;
      err.details = postRes.body;
      if (silent) return null;
      throw err;
    }

    const docId = postRes.body?.id;
    if (!docId) {
      const err = new Error("Resposta Nuvem Fiscal sem id do documento.");
      err.statusCode = 502;
      throw err;
    }

    await prisma.invoice.update({
      where: { saleId },
      data: { externalId: docId }
    });

    const polled = await pollNfceStatus(nf, docId);
    if (polled.error) {
      await prisma.invoice.update({
        where: { saleId },
        data: { status: InvoiceStatus.ERROR, lastError: polled.error }
      });
      const err = new Error(polled.error);
      err.statusCode = 504;
      if (silent) return null;
      throw err;
    }

    const final = polled.body;
    const chave = final?.chave || final?.autorizacao?.chave_acesso;
    const numero = final?.numero != null ? String(final.numero) : null;
    const codigo = final?.autorizacao?.codigo_status;

    const autorizada = codigo === 100 || codigo === 150;

    if (!autorizada) {
      const motivo = final?.autorizacao?.motivo_status || JSON.stringify(final).slice(0, 2000);
      await prisma.invoice.update({
        where: { saleId },
        data: { status: InvoiceStatus.ERROR, lastError: motivo.slice(0, 65000) }
      });
      const err = new Error(motivo);
      err.statusCode = 502;
      err.details = final;
      if (silent) return null;
      throw err;
    }

    const pdfPath = `/nfce/${encodeURIComponent(docId)}/pdf`;

    await prisma.invoice.update({
      where: { saleId },
      data: {
        status: InvoiceStatus.ISSUED,
        key: chave || null,
        number: numero,
        issuedAt: new Date(),
        lastError: null,
        pdfUrl: pdfPath,
        emissionStartedAt: null
      }
    });

    await prisma.nfceIssueJob.updateMany({
      where: { saleId },
      data: {
        status: NfceIssueJobStatus.COMPLETED,
        lastError: null,
        runAt: null
      }
    });

    return prisma.invoice.findUnique({ where: { saleId } });
  } finally {
    await releaseEmissionLease(saleId);
  }
}

/**
 * Baixa PDF da NFC-e na Nuvem Fiscal (uso interno do controller).
 */
async function fetchNfcePdfBuffer(tenantId, saleId) {
  const nf = env.nuvemFiscal;
  if (!nf.clientId || !nf.clientSecret) {
    const err = new Error("Nuvem Fiscal nao configurado.");
    err.statusCode = 503;
    throw err;
  }

  const invoice = await prisma.invoice.findFirst({
    where: { tenantId, saleId, status: InvoiceStatus.ISSUED }
  });
  if (!invoice?.externalId) {
    const err = new Error("NFC-e nao encontrada ou ainda nao autorizada.");
    err.statusCode = 404;
    throw err;
  }

  const token = await getNuvemFiscalAccessToken(nf);
  const docStatus = await getNfceById(nf, invoice.externalId);
  if (docStatus.ok) {
    const codigo = docStatus.body?.autorizacao?.codigo_status;
    const autorizado = codigo === 100 || codigo === 150;
    if (!autorizado) {
      const motivo =
        docStatus.body?.autorizacao?.motivo_status ||
        "NFC-e ainda nao autorizada para disponibilizar PDF.";
      const err = new Error(motivo);
      err.statusCode = 409;
      throw err;
    }
  }

  const candidates = [invoice.externalId, invoice.key].filter(Boolean);
  let res;
  let lastStatus = 404;
  let lastBody = null;

  // O PDF (DANFE) pode demorar alguns segundos para ficar disponivel apos autorizacao.
  for (const docRef of candidates) {
    const url = `${nf.apiBase}/nfce/${encodeURIComponent(docRef)}/pdf`;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" }
      });
      if (res.ok) break;
      lastStatus = res.status;
      const maybeText = await res.text().catch(() => "");
      lastBody = maybeText || lastBody;
      if (res.status !== 404 || attempt === 6) break;
      await sleep(1500);
    }
    if (res?.ok) break;
  }

  if (!res?.ok) {
    const err = new Error(`Nuvem Fiscal retornou ${lastStatus} ao baixar PDF.`);
    err.statusCode = 502;
    if (lastBody) err.details = lastBody.slice(0, 1000);
    throw err;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, filename: `nfce-${invoice.number || saleId}.pdf` };
}

export const invoiceService = {
  connectionTest,
  issueFromSale,
  fetchNfcePdfBuffer,
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
