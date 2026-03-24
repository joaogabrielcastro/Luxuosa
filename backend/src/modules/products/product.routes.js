import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { productController } from "./product.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", productController.list);
router.get("/low-stock", productController.lowStock);
router.get("/:id", productController.getById);
router.post("/", productController.create);
router.put("/:id", productController.update);
router.delete("/:id", productController.remove);

export { router as productRoutes };
