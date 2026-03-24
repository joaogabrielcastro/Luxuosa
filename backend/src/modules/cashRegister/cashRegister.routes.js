import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { cashRegisterController } from "./cashRegister.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/current", cashRegisterController.current);
router.post("/open", cashRegisterController.open);
router.post("/:id/movements", cashRegisterController.addMovement);
router.post("/:id/close", cashRegisterController.close);

export { router as cashRegisterRoutes };
