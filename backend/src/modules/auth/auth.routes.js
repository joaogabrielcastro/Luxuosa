import { Router } from "express";
import { authController } from "./auth.controller.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { loginRateLimit } from "../../middlewares/loginRateLimit.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.post("/login", loginRateLimit, authController.login);
router.post("/register", loginRateLimit, authController.register);
router.post("/logout", authMiddleware, tenantMiddleware, authController.logout);
router.get("/me", authMiddleware, tenantMiddleware, authController.me);
router.get("/stores", authMiddleware, tenantMiddleware, authController.stores);
router.post("/switch-store", authMiddleware, tenantMiddleware, authController.switchStore);

export { router as authRoutes };
