/** @typedef {{ endereco: { logradouro: string; numero?: string; complemento?: string; bairro: string; codigo_municipio: string; cidade: string; uf: string; cep: string }; cpf_cnpj: string; nome_razao_social: string; nome_fantasia?: string; inscricao_estadual?: string; fone?: string }} EmpresaNuvem */

const UF_CUF = {
  RO: 11,
  AC: 12,
  AM: 13,
  RR: 14,
  PA: 15,
  AP: 16,
  TO: 17,
  MA: 21,
  PI: 22,
  CE: 23,
  RN: 24,
  PB: 25,
  PE: 26,
  AL: 27,
  SE: 28,
  BA: 29,
  MG: 31,
  ES: 32,
  RJ: 33,
  SP: 35,
  PR: 41,
  SC: 42,
  RS: 43,
  MS: 50,
  MT: 51,
  GO: 52,
  DF: 53
};

const PAYMENT_TO_TPAG = {
  CASH: "01",
  CREDIT_CARD: "03",
  DEBIT_CARD: "04",
  PIX: "17",
  INSTALLMENT: "03"
};

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function randomCNF() {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16))
    .join("")
    .toUpperCase();
}

function buildEmit(empresa, crt) {
  const e = empresa.endereco;
  const ie = empresa.inscricao_estadual?.trim();
  return {
    CNPJ: digitsOnly(empresa.cpf_cnpj),
    xNome: empresa.nome_razao_social,
    xFant: empresa.nome_fantasia || empresa.nome_razao_social,
    IE: ie && ie.length > 0 ? ie : "ISENTO",
    CRT: crt ?? 1,
    enderEmit: {
      xLgr: e.logradouro,
      nro: e.numero || "S/N",
      ...(e.complemento ? { xCpl: e.complemento } : {}),
      xBairro: e.bairro,
      cMun: digitsOnly(e.codigo_municipio),
      xMun: e.cidade,
      UF: e.uf,
      CEP: digitsOnly(e.cep),
      cPais: "1058",
      xPais: "Brasil",
      ...(digitsOnly(empresa.fone) ? { fone: digitsOnly(empresa.fone) } : {})
    }
  };
}

export function customerFiscalComplete(customer) {
  if (!customer) return false;
  return (
    String(customer.uf || "").trim().length === 2 &&
    digitsOnly(customer.cep).length >= 8 &&
    digitsOnly(customer.ibgeMunicipio).length === 7 &&
    String(customer.municipioNome || "").trim().length >= 2
  );
}

/** Destinatario NFC-e para venda sem identificacao (endereco do estabelecimento). */
export function buildDestConsumidorFinal(empresa) {
  const e = empresa.endereco;
  return {
    xNome: "CONSUMIDOR FINAL",
    indIEDest: 9,
    enderDest: {
      xLgr: e.logradouro,
      nro: e.numero || "S/N",
      ...(e.complemento ? { xCpl: e.complemento } : {}),
      xBairro: e.bairro,
      cMun: digitsOnly(e.codigo_municipio),
      xMun: e.cidade,
      UF: e.uf,
      CEP: digitsOnly(e.cep),
      cPais: "1058",
      xPais: "Brasil"
    }
  };
}

function buildDest(customer) {
  const doc = digitsOnly(customer.cpfCnpj);
  const dest = {
    xNome: customer.name,
    indIEDest: 9,
    enderDest: {
      xLgr: (customer.address || "NAO INFORMADO").slice(0, 60),
      nro: "S/N",
      xBairro: "CENTRO",
      cMun: digitsOnly(customer.ibgeMunicipio),
      xMun: customer.municipioNome,
      UF: customer.uf,
      CEP: digitsOnly(customer.cep),
      cPais: "1058",
      xPais: "Brasil"
    }
  };
  if (doc.length === 11) dest.CPF = doc;
  else dest.CNPJ = doc;
  return dest;
}

function buildDetItem(item, nItem) {
  const p = item.productVariation.product;
  const v = item.productVariation;
  const qCom = item.quantity;
  const vUnCom = round2(Number(item.unitPrice));
  const vProd = round2(qCom * vUnCom);
  const xProd = `${p.name} ${v.size} ${v.color}`.trim().slice(0, 120);
  const ncm = digitsOnly(p.ncm).slice(0, 8).padStart(8, "0");
  const cfop = digitsOnly(p.cfop).slice(0, 4).padStart(4, "0");

  return {
    nItem,
    prod: {
      cProd: p.sku.slice(0, 60),
      cEAN: "SEM GTIN",
      xProd,
      NCM: ncm,
      CFOP: cfop,
      uCom: "UN",
      qCom,
      vUnCom,
      vProd,
      cEANTrib: "SEM GTIN",
      uTrib: "UN",
      qTrib: qCom,
      vUnTrib: vUnCom,
      indTot: 1
    },
    imposto: {
      ICMS: {
        ICMSSN102: {
          orig: p.icmsOrig,
          CSOSN: String(p.icmsCsosn)
        }
      },
      PIS: { PISNT: { CST: "07" } },
      COFINS: { COFINSNT: { CST: "07" } }
    }
  };
}

/**
 * NFC-e modelo 65 — varejo / consumidor. POST /nfce na Nuvem Fiscal.
 * Com cliente + dados fiscais completos usa CPF/CNPJ e endereco do cliente; senao CONSUMIDOR FINAL no endereco do emitente.
 */
export function buildNfceRequestBody({ sale, empresa, empresaNfce, ambiente, referencia }) {
  const emit = buildEmit(empresa, empresaNfce?.CRT);
  const useCustomer =
    sale.customer && customerFiscalComplete(sale.customer) && digitsOnly(sale.customer.cpfCnpj).length >= 11;
  const dest = useCustomer ? buildDest(sale.customer) : buildDestConsumidorFinal(empresa);

  const emitUF = empresa.endereco.uf;
  const destUF = useCustomer ? sale.customer.uf : emitUF;
  const idDest = emitUF === destUF ? 1 : 2;
  const cUF = UF_CUF[emitUF] ?? 41;
  const dhEmi = new Date(sale.occurredAt).toISOString();
  const cNF = randomCNF();

  const ide = {
    cUF,
    cNF,
    natOp: "VENDA DE MERCADORIA",
    mod: 65,
    serie: 1,
    nNF: 1,
    dhEmi,
    tpNF: 1,
    idDest,
    cMunFG: digitsOnly(empresa.endereco.codigo_municipio),
    tpImp: 4,
    tpEmis: 1,
    cDV: 0,
    tpAmb: ambiente === "producao" ? 1 : 2,
    finNFe: 1,
    indFinal: 1,
    indPres: 1,
    procEmi: 0,
    verProc: "Luxuosa"
  };

  const det = sale.items.map((it, idx) => buildDetItem(it, idx + 1));
  const vProdItens = det.reduce((acc, d) => acc + d.prod.vProd, 0);
  const vProd = round2(vProdItens);
  const vNF = round2(Number(sale.totalValue));
  const vDesc = round2(Math.max(0, vProd - vNF));

  const total = {
    ICMSTot: {
      vBC: 0,
      vICMS: 0,
      vICMSDeson: 0,
      vFCP: 0,
      vBCST: 0,
      vST: 0,
      vFCPST: 0,
      vFCPSTRet: 0,
      vProd,
      vFrete: 0,
      vSeg: 0,
      vDesc,
      vII: 0,
      vIPI: 0,
      vIPIDevol: 0,
      vPIS: 0,
      vCOFINS: 0,
      vOutro: 0,
      vNF
    }
  };

  const tPag = PAYMENT_TO_TPAG[sale.paymentMethod] || "01";

  const pag = {
    detPag: [
      {
        indPag: 0,
        tPag,
        vPag: vNF
      }
    ],
    vTroco: 0
  };

  return {
    infNFe: {
      versao: "4.00",
      Id: "",
      ide,
      emit,
      dest,
      det,
      total,
      transp: { modFrete: 9 },
      pag,
      infAdic: {
        infCpl: `NFC-e venda ${sale.id} — ref ${referencia}`
      }
    },
    ambiente,
    referencia
  };
}
