import { Router } from "express";
import { userController } from "./user.controller.js";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get("/", requireAdmin, userController.list);
router.post("/", requireAdmin, userController.create);
router.put("/:id", requireAdmin, userController.update);
router.delete("/:id", requireAdmin, userController.remove);

export { router as userRoutes };
