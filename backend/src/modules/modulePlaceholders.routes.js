import { Router } from "express";
import { authMiddleware, requireAdmin } from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get("/stock-movements", (_req, res) => res.json({ message: "Movimentacoes de estoque: pronto para entrada/saida" }));
router.get("/invoices", (_req, res) => res.json({ message: "NF-e: pronto para integracao externa" }));
router.get("/reports", requireAdmin, (_req, res) => res.json({ message: "Relatorios: pronto para agregacoes" }));

export { router as modulePlaceholdersRoutes };
