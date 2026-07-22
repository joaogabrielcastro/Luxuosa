import { env } from "../../config/env.js";
import { getNuvemFiscalAccessToken } from "./nuvemFiscalAuth.js";

function mockChave() {
  const prefix = "3524";
  let rest = "";
  while (rest.length < 40) {
    rest += String(Math.floor(Math.random() * 1e12)).padStart(12, "0");
  }
  return (prefix + rest).slice(0, 44);
}

function mockAuthorizedBody(overrides = {}) {
  const chave = overrides.chave || mockChave();
  const id = overrides.id || `mock_${Date.now()}`;
  return {
    id,
    status: "autorizado",
    chave,
    numero: overrides.numero || "1",
    autorizacao: {
      codigo_status: 100,
      motivo_status: "Autorizado o uso da NF-e (mock)",
      chave_acesso: chave
    },
    ...overrides
  };
}

function mockEmpresaBody(cnpjDigits) {
  const cnpj = String(cnpjDigits || "").replace(/\D/g, "") || "00000000000000";
  return {
    cnpj,
    cpf_cnpj: cnpj,
    razao_social: "Mock",
    nome_razao_social: "Mock",
    nome_fantasia: "Mock",
    inscricao_estadual: "1234567890",
    endereco: {
      logradouro: "Rua Mock",
      numero: "100",
      bairro: "Centro",
      codigo_municipio: "3550308",
      cidade: "Sao Paulo",
      uf: "SP",
      cep: "01001000"
    }
  };
}

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
  if (env.nfceMock) {
    return Promise.resolve({
      ok: true,
      status: 200,
      body: mockEmpresaBody(cnpjDigits)
    });
  }
  return nuvemFiscalJson(config, `/empresas/${cnpjDigits}`);
}

export function getEmpresaNfceConfig(config, cnpjDigits) {
  if (env.nfceMock) {
    return Promise.resolve({
      ok: true,
      status: 200,
      body: { ambiente: "homologacao", serie: 1, numero: 1 }
    });
  }
  return nuvemFiscalJson(config, `/empresas/${cnpjDigits}/nfce`);
}

export function postNfce(config, payload) {
  if (env.nfceMock) {
    return Promise.resolve({
      ok: true,
      status: 200,
      body: mockAuthorizedBody()
    });
  }
  return nuvemFiscalJson(config, "/nfce", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getNfceById(config, documentId) {
  if (env.nfceMock) {
    return Promise.resolve({
      ok: true,
      status: 200,
      body: mockAuthorizedBody({ id: documentId })
    });
  }
  return nuvemFiscalJson(config, `/nfce/${encodeURIComponent(documentId)}`);
}
