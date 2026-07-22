import { XMLParser } from "fast-xml-parser";
import { createAppError, ERROR_CODES } from "../utils/appErrors.js";

const MAX_XML_BYTES = 2 * 1024 * 1024;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  isArray: (name) => ["det", "detPag", "dup"].includes(name)
});

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (value["#text"] != null) return String(value["#text"]).trim();
    return "";
  }
  return String(value).trim();
}

function digitsOnly(value) {
  return text(value).replace(/\D/g, "");
}

function toNumber(value) {
  const raw = text(value).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function normalizeEan(value) {
  const d = digitsOnly(value);
  if (!d || /^0+$/.test(d)) return null;
  if (d.length < 8 || d.length > 14) return null;
  return d;
}

function parseIssuedAt(raw) {
  const s = text(raw);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function findInfNfe(parsed) {
  const root = parsed?.nfeProc || parsed?.NFe || parsed;
  const nfe = root?.NFe || root;
  const inf = nfe?.infNFe;
  if (inf) return { inf, prot: root?.protNFe?.infProt || null };
  return null;
}

function extractAccessKey(inf, prot) {
  const fromId = text(inf?.["@_Id"]).replace(/^NFe/i, "");
  if (/^\d{44}$/.test(fromId)) return fromId;
  const fromProt = digitsOnly(prot?.chNFe);
  if (/^\d{44}$/.test(fromProt)) return fromProt;
  return null;
}

function extractPaymentInfo(inf) {
  const pag = inf?.pag;
  if (!pag) return null;
  const dets = asArray(pag.detPag);
  if (!dets.length) return null;
  const labels = {
    "01": "Dinheiro",
    "02": "Cheque",
    "03": "Cartao de credito",
    "04": "Cartao de debito",
    "05": "Credito loja",
    "10": "Vale alimentacao",
    "11": "Vale refeicao",
    "12": "Vale presente",
    "13": "Vale combustivel",
    "15": "Boleto",
    "16": "Deposito bancario",
    "17": "PIX",
    "18": "Transferencia",
    "19": "Programa de fidelidade",
    "90": "Sem pagamento",
    "99": "Outros"
  };
  const parts = dets.map((d) => {
    const tPag = text(d.tPag).padStart(2, "0");
    const vPag = toNumber(d.vPag);
    const label = labels[tPag] || `Forma ${tPag}`;
    return vPag > 0 ? `${label} (${vPag.toFixed(2)})` : label;
  });
  return parts.filter(Boolean).join("; ") || null;
}

function mapItem(det) {
  const prod = det?.prod || {};
  const imposto = det?.imposto || {};
  const lineNumber = Number(text(det?.["@_nItem"]) || 0) || 0;
  const quantity = toNumber(prod.qCom);
  const unitValue = toNumber(prod.vUnCom);
  const totalValue = toNumber(prod.vProd) || Number((quantity * unitValue).toFixed(2));
  const ean = normalizeEan(prod.cEAN) || normalizeEan(prod.cEANTrib);

  let icmsOrig = null;
  let icmsCsosn = null;
  const icmsNode = imposto.ICMS || {};
  const icmsChild = Object.values(icmsNode)[0];
  if (icmsChild && typeof icmsChild === "object") {
    const orig = text(icmsChild.orig);
    if (orig !== "") icmsOrig = Number(orig);
    const csosn = text(icmsChild.CSOSN || icmsChild.CST);
    if (csosn) icmsCsosn = csosn;
  }

  return {
    lineNumber,
    supplierCode: text(prod.cProd) || null,
    ean,
    description: text(prod.xProd) || "Produto sem descricao",
    ncm: digitsOnly(prod.NCM).slice(0, 8) || null,
    cfop: digitsOnly(prod.CFOP).slice(0, 4) || null,
    unit: text(prod.uCom) || null,
    quantity,
    unitValue,
    totalValue,
    tax: {
      icmsOrig: Number.isFinite(icmsOrig) ? icmsOrig : null,
      icmsCsosn: icmsCsosn || null
    }
  };
}

/**
 * Valida e extrai dados de um XML de NF-e (modelo 55) ou NFC-e (65) com itens.
 * @param {string} xmlContent
 */
export function parseNfeXml(xmlContent) {
  if (xmlContent == null || typeof xmlContent !== "string") {
    throw createAppError("Arquivo XML nao informado.", 400, ERROR_CODES.VALIDATION);
  }

  const trimmed = xmlContent.trim();
  if (!trimmed) {
    throw createAppError("Arquivo XML vazio.", 400, ERROR_CODES.VALIDATION);
  }
  if (Buffer.byteLength(trimmed, "utf8") > MAX_XML_BYTES) {
    throw createAppError("Arquivo XML excede o limite de 2 MB.", 400, ERROR_CODES.VALIDATION);
  }
  if (!trimmed.includes("<") || !/nfe|NFe|infNFe/i.test(trimmed)) {
    throw createAppError("O arquivo nao parece ser um XML de NF-e valido.", 400, ERROR_CODES.VALIDATION);
  }

  let parsed;
  try {
    parsed = parser.parse(trimmed);
  } catch {
    throw createAppError("Nao foi possivel ler o XML. Verifique se o arquivo esta integro.", 400, ERROR_CODES.VALIDATION);
  }

  const found = findInfNfe(parsed);
  if (!found?.inf) {
    throw createAppError(
      "XML invalido: estrutura de NF-e nao encontrada (infNFe).",
      400,
      ERROR_CODES.VALIDATION
    );
  }

  const { inf, prot } = found;
  const ide = inf.ide || {};
  const emit = inf.emit || {};
  const model = text(ide.mod) || "55";

  const accessKey = extractAccessKey(inf, prot);
  if (!accessKey) {
    throw createAppError(
      "Chave de acesso da NF-e nao encontrada no XML.",
      400,
      ERROR_CODES.VALIDATION
    );
  }

  const supplierCnpj = digitsOnly(emit.CNPJ || emit.CPF);
  if (supplierCnpj.length !== 14 && supplierCnpj.length !== 11) {
    throw createAppError("CNPJ/CPF do emitente invalido no XML.", 400, ERROR_CODES.VALIDATION);
  }

  const issuedAt = parseIssuedAt(ide.dhEmi || ide.dEmi);
  if (!issuedAt) {
    throw createAppError("Data de emissao invalida no XML.", 400, ERROR_CODES.VALIDATION);
  }

  const items = asArray(inf.det).map(mapItem).filter((item) => item.lineNumber > 0);
  if (!items.length) {
    throw createAppError("A NF-e nao possui itens (det/prod).", 400, ERROR_CODES.VALIDATION);
  }

  const totalValue = toNumber(inf.total?.ICMSTot?.vNF);
  const number = text(ide.nNF) || accessKey.slice(25, 34).replace(/^0+/, "") || "0";
  const series = text(ide.serie) || "1";

  return {
    accessKey,
    number,
    series,
    model,
    issuedAt: issuedAt.toISOString(),
    supplier: {
      cnpj: supplierCnpj.length === 14 ? supplierCnpj : null,
      cpf: supplierCnpj.length === 11 ? supplierCnpj : null,
      taxId: supplierCnpj,
      name: text(emit.xNome) || "Fornecedor sem nome",
      tradeName: text(emit.xFant) || null,
      stateRegistration: text(emit.IE) || null
    },
    totalValue: totalValue || items.reduce((acc, i) => acc + i.totalValue, 0),
    paymentInfo: extractPaymentInfo(inf),
    itemCount: items.length,
    items
  };
}

export const NFE_XML_MAX_BYTES = MAX_XML_BYTES;
