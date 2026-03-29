import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { brandController } from "./brand.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", brandController.list);
router.get("/:id", brandController.getById);
router.post("/", brandController.create);
router.put("/:id", brandController.update);
router.delete("/:id", brandController.remove);

export { router as brandRoutes };
