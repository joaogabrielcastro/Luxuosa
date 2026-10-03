import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { auditLogController } from "./auditLog.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", requireAdmin, auditLogController.list);

export { router as auditLogRoutes };
