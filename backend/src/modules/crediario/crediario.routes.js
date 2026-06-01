import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { crediarioController } from "./crediario.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", crediarioController.list);
router.get("/:id", crediarioController.getById);
router.post("/", requireAdmin, crediarioController.create);
router.post("/:id/payments", crediarioController.addPayment);
router.post("/:id/cancel", requireAdmin, crediarioController.cancel);

export { router as crediarioRoutes };
