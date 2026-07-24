import { z } from "zod";
import { parsePageQuery } from "../../shared/pagination.js";
import { ERROR_CODES } from "../../utils/appErrors.js";
import { nfeImportService } from "./nfeImport.service.js";

const xmlBodySchema = z.object({
  xmlContent: z.string().min(20).max(2_500_000)
});

const supplierDecisionSchema = z.object({
  action: z.enum(["use_existing", "create", "skip"]),
  supplierId: z.string().min(1).optional().nullable(),
  name: z.string().min(2).max(200).optional(),
  tradeName: z.string().max(200).optional().nullable(),
  stateRegistration: z.string().max(30).optional().nullable()
});

const itemDecisionSchema = z.object({
  lineNumber: z.coerce.number().int().positive(),
  action: z.enum(["link", "create", "ignore"]),
  productId: z.string().min(1).optional().nullable(),
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  brandId: z.string().min(1).optional().nullable(),
  price: z.coerce.number().nonnegative().optional(),
  sku: z.string().max(80).optional().nullable(),
  minStock: z.coerce.number().int().nonnegative().optional(),
  quantityEntered: z.coerce.number().int().positive().optional(),
  updateCost: z.boolean().optional(),
  updatePrice: z.boolean().optional()
});

const confirmSchema = z.object({
  xmlContent: z.string().min(20).max(2_500_000),
  supplierDecision: supplierDecisionSchema,
  items: z.array(itemDecisionSchema).min(1)
});

export const nfeImportController = {
  async list(req, res, next) {
    try {
      const { take, skip } = parsePageQuery(req.query, { defaultTake: 50, maxTake: 200 });
      const result = await nfeImportService.list(req.tenantId, { take, skip });
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const item = await nfeImportService.getById(req.tenantId, req.params.id);
      if (!item) return res.status(404).json({ error: "Importacao nao encontrada." });
      return res.json(item);
    } catch (error) {
      return next(error);
    }
  },

  async preview(req, res, next) {
    try {
      const { xmlContent } = xmlBodySchema.parse(req.body);
      const preview = await nfeImportService.preview(req.tenantId, xmlContent);
      return res.json(preview);
    } catch (error) {
      if (error.statusCode === 409 && error.existingImport) {
        return res.status(409).json({
          error: error.message,
          code: ERROR_CODES.CONFLICT,
          existingImport: error.existingImport
        });
      }
      return next(error);
    }
  },

  async confirm(req, res, next) {
    try {
      const payload = confirmSchema.parse(req.body);
      const result = await nfeImportService.confirm(req.tenantId, req.user.id, payload);
      return res.status(201).json(result);
    } catch (error) {
      if (error.statusCode === 409 && error.existingImport) {
        return res.status(409).json({
          error: error.message,
          code: ERROR_CODES.CONFLICT,
          existingImport: error.existingImport
        });
      }
      return next(error);
    }
  }
};
