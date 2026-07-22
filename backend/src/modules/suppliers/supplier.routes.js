import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { supplierController } from "./supplier.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", supplierController.list);
router.get("/:id", supplierController.getById);
router.post("/", requireAdmin, supplierController.create);
router.put("/:id", requireAdmin, supplierController.update);

export { router as supplierRoutes };
