import { prisma } from "../config/prisma.js";
import { planAtLeast } from "../shared/planCatalog.js";

/**
 * Exige plano minimo do tenant (BASIC < PRO < ENTERPRISE).
 * @param {"BASIC"|"PRO"|"ENTERPRISE"} minPlan
 */
export function requirePlan(minPlan) {
  return async function requirePlanMiddleware(req, _res, next) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        const err = new Error("Tenant nao resolvido.");
        err.statusCode = 401;
        return next(err);
      }
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true }
      });
      if (!tenant) {
        const err = new Error("Loja nao encontrada.");
        err.statusCode = 404;
        return next(err);
      }
      if (!planAtLeast(tenant.plan, minPlan)) {
        const err = new Error(
          `Recurso disponivel a partir do plano ${minPlan}. Atualize em Assinatura.`
        );
        err.statusCode = 402;
        err.code = "PLAN_UPGRADE_REQUIRED";
        err.details = [{ plan: tenant.plan, required: minPlan }];
        return next(err);
      }
      req.tenantPlan = tenant.plan;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
