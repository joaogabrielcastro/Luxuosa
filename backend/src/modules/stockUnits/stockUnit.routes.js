import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { stockUnitController } from "./stockUnit.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/resolve", stockUnitController.resolve);
router.get("/", stockUnitController.listByVariation);
router.post("/", stockUnitController.create);
router.delete("/:id", stockUnitController.remove);

export { router as stockUnitRoutes };
