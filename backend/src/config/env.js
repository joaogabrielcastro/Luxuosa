import dotenv from "dotenv";

dotenv.config();

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const env = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  nuvemFiscal: {
    clientId: trimEnv(process.env.NUVEM_FISCAL_CLIENT_ID),
    clientSecret: trimEnv(process.env.NUVEM_FISCAL_CLIENT_SECRET),
    apiBase: trimEnv(process.env.NUVEM_FISCAL_API_BASE || "https://api.sandbox.nuvemfiscal.com.br").replace(/\/$/, ""),
    oauthScope: trimEnv(process.env.NUVEM_FISCAL_OAUTH_SCOPE || "empresa nfe nfce"),
    /** homologacao | producao — deve coincidir com a configuração da empresa na Nuvem Fiscal */
    ambiente: trimEnv(process.env.NUVEM_FISCAL_AMBIENTE || "homologacao"),
    /** CNPJ só dígitos; se vazio, usa Tenant.cnpj na emissão */
    emitenteCnpj: trimEnv(process.env.NUVEM_FISCAL_EMITENTE_CNPJ || "")
  }
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET nao configurado.");
}
