import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    const err = new Error("Token nao informado.");
    err.statusCode = 401;
    return next(err);
  }

  const [, token] = authHeader.split(" ");

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: payload.sub,
      tenantId: payload.tenant_id,
      type: payload.user_type
    };
    return next();
  } catch {
    const err = new Error("Token invalido.");
    err.statusCode = 401;
    return next(err);
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.type !== "ADMIN") {
    const err = new Error("Acesso permitido apenas para admin.");
    err.statusCode = 403;
    return next(err);
  }
  return next();
}
