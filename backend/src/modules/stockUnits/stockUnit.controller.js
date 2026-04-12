import { z } from "zod";
import { stockUnitService } from "./stockUnit.service.js";

const createSchema = z.object({
  productVariationId: z.string().min(1),
  barcode: z.string().min(2),
  notes: z.string().optional()
});

export const stockUnitController = {
  async listByVariation(req, res, next) {
    try {
      const productVariationId = String(req.query.productVariationId || "");
      if (!productVariationId) {
        return res.status(400).json({ error: "Informe productVariationId." });
      }
      const items = await stockUnitService.listByVariation(req.tenantId, productVariationId);
      return res.json(items);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = createSchema.parse(req.body);
      const unit = await stockUnitService.create(req.tenantId, payload);
      return res.status(201).json(unit);
    } catch (error) {
      if (error.code === "P2002") return res.status(409).json({ error: "Codigo de barras ja cadastrado nesta loja." });
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await stockUnitService.remove(req.tenantId, req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },

  async resolve(req, res, next) {
    try {
      const barcode = String(req.query.barcode || "").trim();
      if (!barcode) {
        return res.status(400).json({ error: "Informe barcode na query." });
      }
      const resolved = await stockUnitService.resolveBarcode(req.tenantId, barcode);
      if (!resolved) return res.status(404).json({ error: "Codigo nao encontrado." });
      return res.json(resolved);
    } catch (error) {
      return next(error);
    }
  }
};
