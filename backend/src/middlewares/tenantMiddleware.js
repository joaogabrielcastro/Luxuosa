export function tenantMiddleware(req, _res, next) {
  if (!req.user?.tenantId) {
    const err = new Error("Tenant nao identificado.");
    err.statusCode = 403;
    return next(err);
  }

  req.tenantId = req.user.tenantId;
  return next();
}
