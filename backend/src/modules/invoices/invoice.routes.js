import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { invoiceController } from "./invoice.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/connection-test", requireAdmin, invoiceController.connectionTest);
router.post("/issue/:saleId", invoiceController.issue);
router.get("/sale/:saleId/pdf", invoiceController.downloadPdf);

export { router as invoiceRoutes };
