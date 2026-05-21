/**
 * Mensagens de erro da API em portugues para o utilizador final.
 */

const STATUS_DEFAULTS = {
  400: "Nao foi possivel concluir. Verifique os dados e tente novamente.",
  401: "Sessao expirada ou nao autorizada. Faca login novamente.",
  403: "Voce nao tem permissao para esta acao.",
  404: "Registro nao encontrado. Atualize a pagina e tente novamente.",
  409: "Nao e possivel concluir: conflito com dados existentes ou vinculos no sistema.",
  422: "Nao foi possivel processar os dados enviados.",
  502: "Servico externo indisponivel. Tente novamente em instantes.",
  503: "Servico temporariamente indisponivel. Tente novamente.",
  504: "A operacao demorou demais. Tente novamente."
};

const CODE_HINTS = {
  VALIDATION_ERROR: "Revise os campos destacados abaixo.",
  TENANT_CNPJ_REQUIRED:
    "Varias lojas usam este e-mail. Informe o CNPJ da loja (14 digitos) para entrar.",
  TOKEN_EXPIRED: "Sua sessao expirou. Faca login novamente.",
  TOKEN_INVALID: "Sessao invalida. Faca login novamente.",
  CONFLICT: "Esta acao conflita com dados ja cadastrados.",
  NOT_FOUND: "O registro nao foi encontrado. Atualize a pagina.",
  INTERNAL_ERROR: "Erro interno. Tente novamente ou contacte o suporte."
};

/** Padroes tecnicos que nunca devem aparecer na tela. */
const TECHNICAL_PATTERNS = [
  /Invalid `prisma\./i,
  /PrismaClient/i,
  /ConnectorError/i,
  /P20\d{3}/i,
  /foreign key/i,
  /RESTRICT/i,
  /violates/i,
  /Unique constraint/i,
  /ECONNREFUSED/i,
  /Unexpected token/i,
  /SyntaxError/i,
  /at \/app\//i
];

function looksTechnical(text) {
  return TECHNICAL_PATTERNS.some((re) => re.test(text));
}

function defaultForStatus(status) {
  if (status >= 500) return "Erro no servidor. Tente novamente em instantes.";
  return STATUS_DEFAULTS[status] || "Nao foi possivel completar a operacao.";
}

/**
 * @param {object|null} data Corpo JSON da API ({ error, code, details })
 * @param {number} status HTTP status
 */
export function parseApiErrorPayload(data, status) {
  const code = typeof data?.code === "string" ? data.code : null;
  let message = null;

  if (typeof data?.error === "string" && data.error.trim()) {
    message = data.error.trim();
  } else if (typeof data?.message === "string" && data.message.trim()) {
    message = data.message.trim();
  }

  const details = Array.isArray(data?.details)
    ? data.details
        .filter((d) => d && typeof d.message === "string" && d.message.trim())
        .map((d) => ({
          field: d.field || "",
          message: d.message.trim()
        }))
    : [];

  if (message && looksTechnical(message)) {
    message = defaultForStatus(status);
  }

  if (!message) {
    message = code && CODE_HINTS[code] ? CODE_HINTS[code] : defaultForStatus(status);
  } else if (code && CODE_HINTS[code] && !message.includes(CODE_HINTS[code].slice(0, 20))) {
    if (code === "VALIDATION_ERROR" && details.length) {
      message = message;
    } else if (status === 401) {
      message = CODE_HINTS[code] || message;
    }
  }

  if (details.length) {
    const detailText = details.map((d) => d.message).join(" ");
    if (!message.includes(detailText.slice(0, 30))) {
      message = details.length === 1 ? detailText : `${message} ${detailText}`;
    }
  }

  return { message, code, details, status };
}

/**
 * @param {Error & { status?: number, details?: object, code?: string }} err
 */
export function getErrorPresentation(err) {
  const details = err?.details || [];
  return {
    title: err?.status === 401 ? "Sessao encerrada" : "Nao foi possivel concluir",
    message: err?.message || defaultForStatus(err?.status || 500),
    details: Array.isArray(details) ? details : []
  };
}
