import { Router } from "express";
import { authController } from "./auth.controller.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.post("/login", authController.login);
router.post("/logout", authMiddleware, tenantMiddleware, authController.logout);
router.get("/me", authMiddleware, tenantMiddleware, authController.me);

export { router as authRoutes };
