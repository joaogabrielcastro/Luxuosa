import { Router } from "express";
import { customerController } from "./customer.controller.js";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get("/", customerController.list);
router.get("/:id", customerController.getById);
router.post("/", requireAdmin, customerController.create);
router.put("/:id", requireAdmin, customerController.update);
router.delete("/:id", requireAdmin, customerController.remove);

export { router as customerRoutes };
