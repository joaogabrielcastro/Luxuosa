import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { categoryController } from "./category.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", categoryController.list);
router.get("/:id", categoryController.getById);
router.post("/", categoryController.create);
router.put("/:id", categoryController.update);
router.delete("/:id", categoryController.remove);

export { router as categoryRoutes };
