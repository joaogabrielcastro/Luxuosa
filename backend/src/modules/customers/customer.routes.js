import { Router } from "express";
import { customerController } from "./customer.controller.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get("/", customerController.list);
router.get("/:id", customerController.getById);
router.post("/", customerController.create);
router.put("/:id", customerController.update);
router.delete("/:id", customerController.remove);

export { router as customerRoutes };
