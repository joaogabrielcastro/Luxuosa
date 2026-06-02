import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { saleController } from "./sale.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/summary", saleController.listSummary);
router.get("/", saleController.list);
router.get("/:id", saleController.getById);
router.post("/", saleController.create);
router.put("/:id", requireAdmin, saleController.update);
router.post("/:id/cancel", requireAdmin, saleController.cancel);

export { router as saleRoutes };
