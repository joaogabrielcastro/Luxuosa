import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { requirePlan } from "../../middlewares/requirePlan.js";
import { invoiceController } from "./invoice.controller.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/connection-test", requireAdmin, invoiceController.connectionTest);
router.patch("/notaas-config", requireAdmin, invoiceController.updateNotaasConfig);
router.post("/issue/:saleId", requireAdmin, requirePlan("PRO"), invoiceController.issue);
router.get("/sale/:saleId/pdf", invoiceController.downloadPdf);
router.get("/sale/:saleId/job", invoiceController.issueJobStatus);

export { router as invoiceRoutes };
