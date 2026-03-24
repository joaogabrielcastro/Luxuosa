import { z } from "zod";
import { saleService } from "./sale.service.js";

const saleSchema = z.object({
  customerId: z.string().optional(),
  discountValue: z.coerce.number().nonnegative().optional(),
  discountPercent: z.coerce.number().nonnegative().optional(),
  paymentMethod: z.string().min(1),
  installments: z.coerce.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        productVariationId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().positive()
      })
    )
    .min(1)
});

export const saleController = {
  async list(req, res, next) {
    try {
      const data = await saleService.list(req.tenantId);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = saleSchema.parse(req.body);
      const sale = await saleService.create(req.tenantId, req.user.id, payload);
      return res.status(201).json(sale);
    } catch (error) {
      return next(error);
    }
  }
};
