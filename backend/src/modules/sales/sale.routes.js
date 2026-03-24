import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { saleController } from "./sale.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", saleController.list);
router.post("/", saleController.create);

export { router as saleRoutes };
