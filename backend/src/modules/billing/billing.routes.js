import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { billingController } from "./billing.controller.js";

const router = Router();

router.get("/status", authMiddleware, tenantMiddleware, billingController.status);
router.post("/checkout", authMiddleware, tenantMiddleware, requireAdmin, billingController.checkout);
router.post("/portal", authMiddleware, tenantMiddleware, requireAdmin, billingController.portal);
router.post("/sync", authMiddleware, tenantMiddleware, requireAdmin, billingController.sync);

export { router as billingRoutes };
