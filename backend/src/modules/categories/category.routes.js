import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { categoryController } from "./category.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", categoryController.list);
router.get("/:id", categoryController.getById);
router.post("/", requireAdmin, categoryController.create);
router.put("/:id", requireAdmin, categoryController.update);
router.delete("/:id", requireAdmin, categoryController.remove);

export { router as categoryRoutes };
