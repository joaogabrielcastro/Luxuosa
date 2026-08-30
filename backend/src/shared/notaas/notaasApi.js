/**
 * Client HTTP Notaas (NFC-e / NF-e).
 * Base: https://platform.notaas.com.br/api/v1
 * Auth: header x-api-key (project key ntaas_... por loja).
 */

import { env } from "../../config/env.js";

/** @type {{ apiKeyHint: string, referencia: string|null, at: number }[]} */
const mockEmissions = [];

export function clearMockNotaasEmissions() {
  mockEmissions.length = 0;
}

export function getMockNotaasEmissions() {
  return mockEmissions.map((e) => ({ ...e }));
}

function mockChave() {
  const prefix = "4124";
  let rest = "";
  while (rest.length < 40) {
    rest += String(Math.floor(Math.random() * 1e12)).padStart(12, "0");
  }
  return (prefix + rest).slice(0, 44);
}

function mockInvoiceId() {
  return `inv_mock_${Date.now().toString(36)}`;
}

async function notaasFetch(apiKey, path, init = {}) {
  const base = env.notaas.apiBase.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Accept: "application/json",
    "x-api-key": apiKey,
    ...init.headers
  };
  if (init.body != null && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { ...init, headers });
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, status: res.status, body: buf, isBinary: true };
  }
  if (
    contentType.includes("application/xml") ||
    contentType.includes("text/xml") ||
    path.includes("/xml")
  ) {
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text, isBinary: false, isXml: true };
  }
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body, isBinary: false };
}

/**
 * Enfileira NFC-e/NF-e. Retorna 202 com invoiceId.
 * @param {string} apiKey
 * @param {object} payload
 */
export async function postNfeEmitir(apiKey, payload) {
  if (env.nfceMock) {
    const invoiceId = mockInvoiceId();
    mockEmissions.push({
      apiKeyHint: String(apiKey || "").slice(0, 12),
      referencia: payload?.referencia ? String(payload.referencia) : null,
      at: Date.now(),
      invoiceId,
      modelo: payload?.modelo
    });
    return {
      ok: true,
      status: 202,
      body: {
        queued: true,
        invoiceId,
        status: "queued",
        pollUrl: `/api/v1/nfe/invoices/${invoiceId}/status`
      }
    };
  }
  return notaasFetch(apiKey, "/nfe/emitir", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * Polling de status.
 * @param {string} apiKey
 * @param {string} invoiceId
 */
export async function getNfeStatus(apiKey, invoiceId) {
  if (env.nfceMock) {
    const chave = mockChave();
    return {
      ok: true,
      status: 200,
      body: {
        invoiceId,
        status: "issued",
        modelo: 65,
        tpAmb: env.notaas.ambiente === "producao" ? 1 : 2,
        chaveAcesso: chave,
        numero: "1",
        serie: "1",
        pdfUrl: `/api/v1/nfe/invoices/${invoiceId}/danfe`
      }
    };
  }
  return notaasFetch(apiKey, `/nfe/invoices/${encodeURIComponent(invoiceId)}/status`);
}

/**
 * Download DANFE PDF.
 * @param {string} apiKey
 * @param {string} invoiceId
 */
export async function getNfeDanfe(apiKey, invoiceId) {
  if (env.nfceMock) {
    const stub = Buffer.from(
      "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
      "utf8"
    );
    return { ok: true, status: 200, body: stub, isBinary: true };
  }
  return notaasFetch(apiKey, `/nfe/invoices/${encodeURIComponent(invoiceId)}/danfe`, {
    headers: { Accept: "application/pdf" }
  });
}

/**
 * Download XML autorizado da nota.
 * @param {string} apiKey
 * @param {string} invoiceId
 */
export async function getNfeXml(apiKey, invoiceId) {
  if (env.nfceMock) {
    const chave = mockChave();
    const xml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00"><NFe><infNFe Id="NFe${chave}"><ide><mod>65</mod></ide></infNFe></NFe></nfeProc>`;
    return { ok: true, status: 200, body: xml, isBinary: false, isXml: true };
  }
  return notaasFetch(apiKey, `/nfe/invoices/${encodeURIComponent(invoiceId)}/xml`, {
    headers: { Accept: "application/xml" }
  });
}

/**
 * Smoke: lista info basica do projeto (falha = key invalida).
 * Usa status de um id inexistente — 404 com auth OK vs 401.
 */
export async function pingNotaasApiKey(apiKey) {
  if (env.nfceMock) {
    return { ok: true, status: 200, body: { mock: true } };
  }
  // GET status com id dummy: 401 = key ruim; 404 = key ok
  const res = await notaasFetch(apiKey, "/nfe/invoices/ping_luxuosa_probe/status");
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, body: res.body };
  }
  return { ok: true, status: res.status, body: res.body };
}
