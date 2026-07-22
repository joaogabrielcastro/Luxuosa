import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { cashController } from "./cash.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/current", cashController.current);
router.get("/preview", cashController.preview);
router.get("/", cashController.list);
router.post("/open", requireAdmin, cashController.open);
router.post("/:id/close", requireAdmin, cashController.close);

export { router as cashRoutes };
