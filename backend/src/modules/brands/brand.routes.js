import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { brandController } from "./brand.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", brandController.list);
router.get("/:id", brandController.getById);
router.post("/", requireAdmin, brandController.create);
router.put("/:id", requireAdmin, brandController.update);
router.delete("/:id", requireAdmin, brandController.remove);

export { router as brandRoutes };
