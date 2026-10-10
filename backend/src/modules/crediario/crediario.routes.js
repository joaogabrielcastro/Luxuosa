import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { crediarioController } from "./crediario.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/config", crediarioController.getConfig);
router.put("/config", requireAdmin, crediarioController.updateConfig);
router.post("/event/close", requireAdmin, crediarioController.closeEvent);
router.get("/accounts", crediarioController.accounts);
router.get("/customers/:customerId/statement", crediarioController.customerStatement);
router.get("/", crediarioController.list);
router.get("/:id", crediarioController.getById);
router.post("/", crediarioController.create);
router.post("/:id/payments", crediarioController.addPayment);
router.post("/:id/cancel", requireAdmin, crediarioController.cancel);
router.delete("/:id", requireAdmin, crediarioController.remove);

export { router as crediarioRoutes };
