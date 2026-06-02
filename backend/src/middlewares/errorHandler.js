import { Prisma } from "@prisma/client";
import { buildErrorResponse, ERROR_CODES, isOperationalError, mapPrismaError } from "../utils/appErrors.js";
import { logger } from "../utils/logger.js";
import { formatZodError, formatZodErrorDetails, isZodError } from "../utils/zodError.js";

const GENERIC_SERVER_ERROR =
  "Ocorreu um erro no servidor. Tente novamente em instantes. Se persistir, contacte o suporte.";

export function errorHandler(err, req, res, _next) {
  if (isZodError(err)) {
    const message = formatZodError(err) || "Revise os campos do formulario.";
    const details = formatZodErrorDetails(err);
    logger.warn("Validacao rejeitada", {
      path: req.path,
      method: req.method,
      tenant_id: req.tenantId || null
    });
    return res.status(400).json(
      buildErrorResponse({
        error: message,
        code: ERROR_CODES.VALIDATION,
        details
      })
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    if (mapped.status >= 500) {
      logger.error("Prisma", {
        path: req.path,
        method: req.method,
        code: err.code,
        meta: err.meta || null
      });
    } else {
      logger.warn("Prisma", {
        path: req.path,
        method: req.method,
        code: err.code,
        meta: err.meta || null
      });
    }
    return res.status(mapped.status).json(
      buildErrorResponse({ error: mapped.error, code: mapped.code })
    );
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json(
      buildErrorResponse({
        error: "Dados incompletos ou invalidos. Verifique todos os campos obrigatorios.",
        code: ERROR_CODES.VALIDATION
      })
    );
  }

  const status = Number(err.statusCode) || 500;

  if (isOperationalError(err)) {
    logger.warn("Erro operacional", {
      path: req.path,
      method: req.method,
      status,
      error: err.message
    });
    return res.status(status).json(
      buildErrorResponse({
        error: err.message,
        code: err.code || undefined
      })
    );
  }

  logger.error("Unhandled error", {
    path: req.path,
    method: req.method,
    tenant_id: req.tenantId || null,
    error: err.message,
    code: err.code || null
  });

  return res.status(500).json(
    buildErrorResponse({
      error: GENERIC_SERVER_ERROR,
      code: "INTERNAL_ERROR"
    })
  );
}
