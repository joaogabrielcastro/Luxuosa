import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { requirePlan } from "../../middlewares/requirePlan.js";
import { nfeImportController } from "./nfeImport.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", nfeImportController.list);
router.get("/:id", nfeImportController.getById);
router.post("/preview", requireAdmin, requirePlan("PRO"), nfeImportController.preview);
router.post("/confirm", requireAdmin, requirePlan("PRO"), nfeImportController.confirm);

export { router as nfeImportRoutes };
