import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { productVariationController } from "./productVariation.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", productVariationController.list);
router.get("/:id", productVariationController.getById);
router.post("/", productVariationController.create);
router.put("/:id", productVariationController.update);
router.delete("/:id", productVariationController.remove);

export { router as productVariationRoutes };
