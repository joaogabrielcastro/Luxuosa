import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { productVariationController } from "./productVariation.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", productVariationController.list);
router.get("/:id", productVariationController.getById);
router.post("/", requireAdmin, productVariationController.create);
router.put("/:id", requireAdmin, productVariationController.update);
router.delete("/:id", requireAdmin, productVariationController.remove);

export { router as productVariationRoutes };
