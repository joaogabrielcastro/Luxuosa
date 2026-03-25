import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { reportsController } from "./reports.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/sales", reportsController.sales);
router.get("/low-stock", reportsController.lowStock);

export { router as reportsRoutes };
