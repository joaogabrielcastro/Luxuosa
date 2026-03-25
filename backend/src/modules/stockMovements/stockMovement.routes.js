import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { stockMovementController } from "./stockMovement.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", stockMovementController.list);
router.post("/", stockMovementController.create);

export { router as stockMovementRoutes };
