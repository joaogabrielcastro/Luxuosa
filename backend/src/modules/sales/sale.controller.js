import { z } from "zod";
import { parsePageQuery } from "../../shared/pagination.js";
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
  async listSummary(req, res, next) {
    try {
      const { take, skip } = parsePageQuery(req.query, { defaultTake: 50, maxTake: 200 });
      const paymentMethod = req.query.paymentMethod ? String(req.query.paymentMethod) : undefined;
      const nfce = req.query.nfce ? String(req.query.nfce) : undefined;
      const q = req.query.q ? String(req.query.q).trim() : undefined;
      const data = await saleService.list(req.tenantId, { skip, take, paymentMethod, nfce, q, summary: true });
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async list(req, res, next) {
    try {
      const { take, skip } = parsePageQuery(req.query, { defaultTake: 50, maxTake: 200 });
      const paymentMethod = req.query.paymentMethod ? String(req.query.paymentMethod) : undefined;
      const nfce = req.query.nfce ? String(req.query.nfce) : undefined;
      const q = req.query.q ? String(req.query.q).trim() : undefined;
      const summary = !(String(req.query.mode || "").toLowerCase() === "full");
      const data = await saleService.list(req.tenantId, { skip, take, paymentMethod, nfce, q, summary });
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const sale = await saleService.getById(req.tenantId, req.params.id);
      if (!sale) return res.status(404).json({ error: "Venda nao encontrada." });
      return res.json(sale);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = saleSchema.parse(req.body);
      const sale = await saleService.create(req.tenantId, req.user.id, req.user.type, payload);
      return res.status(201).json(sale);
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const payload = saleSchema.parse(req.body);
      const sale = await saleService.update(req.tenantId, req.params.id, req.user.id, req.user.type, payload);
      return res.json(sale);
    } catch (error) {
      return next(error);
    }
  },

  async cancel(req, res, next) {
    try {
      const sale = await saleService.cancel(req.tenantId, req.params.id);
      return res.json(sale);
    } catch (error) {
      return next(error);
    }
  }
};
