import { logger } from "../utils/logger.js";
import { formatZodError, isZodError } from "../utils/zodError.js";

export function errorHandler(err, req, res, _next) {
  if (isZodError(err)) {
    const message = formatZodError(err) || "Dados invalidos.";
    logger.warn("Validacao rejeitada", {
      path: req.path,
      method: req.method,
      tenant_id: req.tenantId || null
    });
    return res.status(400).json({ error: message });
  }

  if (err?.code === "P2002") {
    return res.status(409).json({ error: "Ja existe um registro com estes dados (duplicado)." });
  }

  logger.error("Unhandled error", {
    path: req.path,
    method: req.method,
    tenant_id: req.tenantId || null,
    error: err.message
  });

  const status = err.statusCode || 500;
  const payload = {
    error: err.message || "Erro interno no servidor"
  };
  if (err.code && typeof err.code === "string") {
    payload.code = err.code;
  }
  res.status(status).json(payload);
}
