import dotenv from "dotenv";

dotenv.config();

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Origens permitidas no CORS (lista separada por virgula). Vazio = qualquer origem (comportamento anterior). */
function parseCorsOrigins(raw) {
  return trimEnv(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  nuvemFiscal: {
    clientId: trimEnv(process.env.NUVEM_FISCAL_CLIENT_ID),
    clientSecret: trimEnv(process.env.NUVEM_FISCAL_CLIENT_SECRET),
    apiBase: trimEnv(process.env.NUVEM_FISCAL_API_BASE || "https://api.sandbox.nuvemfiscal.com.br").replace(/\/$/, ""),
    oauthScope: trimEnv(process.env.NUVEM_FISCAL_OAUTH_SCOPE || "empresa nfe nfce"),
    /** homologacao | producao — deve coincidir com a configuração da empresa na Nuvem Fiscal */
    ambiente: trimEnv(process.env.NUVEM_FISCAL_AMBIENTE || "homologacao"),
    /** CNPJ só dígitos; se vazio, usa Tenant.cnpj na emissão */
    emitenteCnpj: trimEnv(process.env.NUVEM_FISCAL_EMITENTE_CNPJ || ""),
    /** IE só dígitos; se vazio, usa inscricao_estadual retornada pela Nuvem (GET empresa). */
    emitenteIe: trimEnv(process.env.NUVEM_FISCAL_EMITENTE_IE || ""),
    /** Responsavel tecnico (infRespTec) — alguns estados exigem este grupo em NFC-e. */
    respTecCnpj: trimEnv(process.env.NUVEM_FISCAL_RESP_TEC_CNPJ || ""),
    respTecContato: trimEnv(process.env.NUVEM_FISCAL_RESP_TEC_CONTATO || ""),
    respTecEmail: trimEnv(process.env.NUVEM_FISCAL_RESP_TEC_EMAIL || ""),
    respTecFone: trimEnv(process.env.NUVEM_FISCAL_RESP_TEC_FONE || ""),
    /** PR (e outras UF): idCSRT + hashCSRT em infRespTec — hash derivado da chave 44 (NT 2018.005). */
    respTecIdCsrt: trimEnv(process.env.NUVEM_FISCAL_RESP_TEC_ID_CSRT || ""),
    /** Segredo CSRT fornecido pela SEFAZ (nao versionar). Com ID_CSRT, o backend calcula hashCSRT por nota. */
    csrt: trimEnv(process.env.NUVEM_FISCAL_CSRT || "")
  }
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET nao configurado.");
}
