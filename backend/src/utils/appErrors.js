/**
 * Erros operacionais (mensagem segura para o cliente) e mapeamento Prisma em PT.
 */

export const ERROR_CODES = {
  VALIDATION: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST"
};

const PRISMA_FIELD_PT = {
  sku: "SKU",
  name: "Nome",
  email: "E-mail",
  cnpj: "CNPJ",
  tenantId: "Loja",
  categoryId: "Categoria",
  brandId: "Marca",
  productId: "Produto",
  size: "Tamanho",
  color: "Cor",
  cpfCnpj: "CPF/CNPJ"
};

/**
 * @param {string} message Mensagem em portugues para o utilizador
 * @param {number} [statusCode=400]
 * @param {string} [code]
 */
export function createAppError(message, statusCode = 400, code = ERROR_CODES.BAD_REQUEST) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.isOperational = true;
  return err;
}

/** Erro com mensagem segura para o cliente (4xx definido no service/controller). */
export function isOperationalError(err) {
  const status = Number(err?.statusCode);
  return status >= 400 && status < 500 && typeof err?.message === "string" && err.message.trim().length > 0;
}

function labelPrismaTarget(target) {
  if (!Array.isArray(target)) return null;
  const labels = target
    .filter((f) => f !== "tenantId")
    .map((f) => PRISMA_FIELD_PT[f] || String(f));
  return labels.length ? labels.join(", ") : null;
}

/**
 * @param {import('@prisma/client').Prisma.PrismaClientKnownRequestError} err
 */
export function mapPrismaError(err) {
  switch (err.code) {
    case "P2002": {
      const fields = labelPrismaTarget(err.meta?.target);
      return {
        status: 409,
        code: ERROR_CODES.CONFLICT,
        error: fields
          ? `Ja existe um cadastro com este(s) dado(s): ${fields}. Altere ou use outro valor.`
          : "Ja existe um registro com estes dados. Verifique se nao esta duplicando nome, SKU ou combinacao."
      };
    }
    case "P2003":
      return {
        status: 409,
        code: ERROR_CODES.CONFLICT,
        error:
          "Nao e possivel concluir: este item ainda esta ligado a vendas, crediario, estoque ou outro cadastro. Remova os vinculos primeiro."
      };
    case "P2025":
      return {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        error: "Registro nao encontrado. Atualize a pagina e tente novamente."
      };
    case "P2014":
      return {
        status: 409,
        code: ERROR_CODES.CONFLICT,
        error: "Nao e possivel excluir: existem registros dependentes. Conclua ou remova os vinculos antes."
      };
    case "P2016":
      return {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        error: "Consulta invalida. Atualize a pagina e tente novamente."
      };
    default:
      return {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        error: "Nao foi possivel concluir a operacao. Verifique os dados e tente novamente."
      };
  }
}

/**
 * Monta corpo JSON padrao da API de erros.
 */
export function buildErrorResponse({ error, code, details }) {
  const payload = { error };
  if (code) payload.code = code;
  if (details?.length) payload.details = details;
  return payload;
}
