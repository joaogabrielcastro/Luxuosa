import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { requirePlan } from "../../middlewares/requirePlan.js";
import { FEATURE_MIN_PLAN } from "../../shared/planCatalog.js";
import { stockAlertController } from "./stockAlert.controller.js";

const router = Router();
const planPro = requirePlan(FEATURE_MIN_PLAN.stockAlerts);

router.use(authMiddleware, tenantMiddleware);
router.get("/settings", requireAdmin, planPro, stockAlertController.getSettings);
router.put("/settings", requireAdmin, planPro, stockAlertController.updateSettings);
router.post("/run", requireAdmin, planPro, stockAlertController.run);
router.get("/logs", stockAlertController.listLogs);

export { router as stockAlertRoutes };
