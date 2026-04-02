import { Prisma } from "@prisma/client";
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

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") {
      return res.status(409).json({
        error:
          "Nao e possivel excluir: ainda ha dados ligados a este item (por exemplo movimentos de estoque ou vendas). Remova os vinculos ou use outra acao."
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Registro nao encontrado." });
    }
    logger.warn("Prisma", {
      path: req.path,
      method: req.method,
      code: err.code,
      meta: err.meta || null
    });
    return res.status(400).json({
      error: "Nao foi possivel concluir a operacao. Verifique os dados e tente novamente."
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: "Dados invalidos para esta operacao." });
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
