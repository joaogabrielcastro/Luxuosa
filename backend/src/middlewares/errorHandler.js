import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, _next) {
  logger.error("Unhandled error", {
    path: req.path,
    method: req.method,
    tenant_id: req.tenantId || null,
    error: err.message
  });

  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Erro interno no servidor"
  });
}
