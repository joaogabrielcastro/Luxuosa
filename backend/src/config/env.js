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
  /** Redis opcional (rate limit de login). Ex.: redis://redis:6379 */
  redisUrl: trimEnv(process.env.REDIS_URL),
  /** false = API so enfileira jobs; processar em worker (NFCE_PROCESS_IN_API=false). */
  nfceProcessInApi: process.env.NFCE_PROCESS_IN_API !== "false",
  /** true = respostas mock do provedor fiscal (dev/testes). */
  nfceMock: process.env.NFCE_MOCK === "true",
  /** Notaas — emissao NFC-e multi-tenant (API key por loja no Tenant). */
  notaas: {
    apiBase: trimEnv(process.env.NOTAAS_API_BASE || "https://platform.notaas.com.br/api/v1").replace(
      /\/$/,
      ""
    ),
    /** Org token opcional (ntaas_org_...) para gestao de projetos — nao usado na emissao. */
    orgToken: trimEnv(process.env.NOTAAS_ORG_TOKEN || ""),
    /** homologacao | producao (informativo; ambiente real e o do projeto no Notaas). */
    ambiente: trimEnv(process.env.NOTAAS_AMBIENTE || "homologacao")
  },
  loginRateLimitMax: Math.max(5, Number(process.env.LOGIN_RATE_LIMIT_MAX || 30)),
  loginRateLimitWindowMs: Math.max(60_000, Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 900_000)),
  /** SMTP opcional para alertas de estoque. Sem config, emails sao logados. */
  smtp: {
    url: trimEnv(process.env.SMTP_URL),
    host: trimEnv(process.env.SMTP_HOST),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: trimEnv(process.env.SMTP_USER),
    pass: trimEnv(process.env.SMTP_PASS),
    from: trimEnv(process.env.SMTP_FROM)
  },
  /** Webhook opcional para WhatsApp (POST JSON). */
  whatsappWebhookUrl: trimEnv(process.env.WHATSAPP_WEBHOOK_URL),
  stripe: {
    secretKey: trimEnv(process.env.STRIPE_SECRET_KEY),
    webhookSecret: trimEnv(process.env.STRIPE_WEBHOOK_SECRET),
    pricePro: trimEnv(process.env.STRIPE_PRICE_PRO),
    priceEnterprise: trimEnv(process.env.STRIPE_PRICE_ENTERPRISE),
    /** URL do frontend para success/cancel/portal return */
    frontendUrl: trimEnv(process.env.FRONTEND_URL || "http://localhost:3006")
  },
  nuvemFiscal: {
    clientId: trimEnv(process.env.NUVEM_FISCAL_CLIENT_ID),
    clientSecret: trimEnv(process.env.NUVEM_FISCAL_CLIENT_SECRET),
    apiBase: trimEnv(process.env.NUVEM_FISCAL_API_BASE || "https://api.sandbox.nuvemfiscal.com.br").replace(/\/$/, ""),
    oauthScope: trimEnv(process.env.NUVEM_FISCAL_OAUTH_SCOPE || "empresa nfe nfce"),
    /** homologacao | producao — deve coincidir com a configuração da empresa na Nuvem Fiscal */
    ambiente: trimEnv(process.env.NUVEM_FISCAL_AMBIENTE || "homologacao"),
    /** CNPJ só dígitos — fallback se Tenant.cnpj inválido; em multi-tenant a loja logada tem prioridade */
    /** @deprecated Nao usado como emitente. Emitente = Tenant.cnpj. */
    emitenteCnpj: trimEnv(process.env.NUVEM_FISCAL_EMITENTE_CNPJ || ""),
    /** @deprecated IE na emissao vem da Empresa Nuvem do CNPJ do tenant. */
    emitenteIe: trimEnv(process.env.NUVEM_FISCAL_EMITENTE_IE || ""),
    /** Responsavel tecnico (infRespTec) — software house, global para todos os tenants. */
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

if (process.env.NODE_ENV === "production" && env.corsOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGINS e obrigatorio em producao (lista de origens separada por virgula). Ex.: https://app.exemplo.com.br"
  );
}
