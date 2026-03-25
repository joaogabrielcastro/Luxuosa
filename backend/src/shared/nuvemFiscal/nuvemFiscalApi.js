import { getNuvemFiscalAccessToken } from "./nuvemFiscalAuth.js";

async function nuvemFiscalJson(config, path, init = {}) {
  const token = await getNuvemFiscalAccessToken(config);
  const url = `${config.apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...init.headers
  };
  if (init.body != null && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

export function getEmpresa(config, cnpjDigits) {
  return nuvemFiscalJson(config, `/empresas/${cnpjDigits}`);
}

export function getEmpresaNfceConfig(config, cnpjDigits) {
  return nuvemFiscalJson(config, `/empresas/${cnpjDigits}/nfce`);
}

export function postNfce(config, payload) {
  return nuvemFiscalJson(config, "/nfce", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getNfceById(config, documentId) {
  return nuvemFiscalJson(config, `/nfce/${encodeURIComponent(documentId)}`);
}
