import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { crediarioController } from "./crediario.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/", crediarioController.list);
router.get("/:id", crediarioController.getById);
router.post("/", crediarioController.create);
router.post("/:id/payments", crediarioController.addPayment);
router.post("/:id/cancel", crediarioController.cancel);

export { router as crediarioRoutes };
