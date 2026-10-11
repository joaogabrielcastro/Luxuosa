import { Router } from "express";
import { customerController } from "./customer.controller.js";
import { authMiddleware, requireAdmin, requireAdminOrCreditEventOperator } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get("/", customerController.list);
router.get("/:id", customerController.getById);
// Exceção de cadastro no atendimento somente para tenants no perfil de evento.
router.post("/", requireAdminOrCreditEventOperator, customerController.create);
router.put("/:id", requireAdminOrCreditEventOperator, customerController.update);
router.delete("/:id", requireAdminOrCreditEventOperator, customerController.remove);

export { router as customerRoutes };
