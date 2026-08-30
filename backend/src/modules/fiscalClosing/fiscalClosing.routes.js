import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { requirePlan } from "../../middlewares/requirePlan.js";
import { fiscalClosingController } from "./fiscalClosing.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware, requireAdmin, requirePlan("PRO"));
router.get("/summary", fiscalClosingController.summary);
router.get("/export", fiscalClosingController.exportZip);

export { router as fiscalClosingRoutes };
