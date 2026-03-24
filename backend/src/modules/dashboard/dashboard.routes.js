import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { dashboardController } from "./dashboard.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware, requireAdmin);
router.get("/admin", dashboardController.admin);

export { router as dashboardRoutes };
