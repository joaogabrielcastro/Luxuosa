import { z } from "zod";
import { parsePageQuery } from "../../shared/pagination.js";
import { crediarioService } from "./crediario.service.js";

const createSchema = z.object({
  customerId: z.string().min(1),
  discountValue: z.coerce.number().nonnegative().optional(),
  discountPercent: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
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

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().min(1),
  paidAt: z.coerce.string().optional(),
  note: z.string().max(1000).optional()
});

export const crediarioController = {
  async list(req, res, next) {
    try {
      const { take, skip } = parsePageQuery(req.query, { defaultTake: 50, maxTake: 200 });
      const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
      const q = req.query.q ? String(req.query.q).trim() : undefined;
      const data = await crediarioService.list(req.tenantId, { skip, take, status, q });
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const row = await crediarioService.getById(req.tenantId, req.params.id);
      if (!row) {
        return res.status(404).json({ error: "Venda a prazo nao encontrada." });
      }
      return res.json(row);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = createSchema.parse(req.body);
      const created = await crediarioService.create(req.tenantId, req.user.id, req.user.type, payload);
      return res.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  },

  async addPayment(req, res, next) {
    try {
      const payload = paymentSchema.parse(req.body);
      const updated = await crediarioService.addPayment(req.tenantId, req.params.id, payload);
      return res.json(updated);
    } catch (error) {
      return next(error);
    }
  },

  async cancel(req, res, next) {
    try {
      const canceled = await crediarioService.cancel(req.tenantId, req.params.id);
      return res.json(canceled);
    } catch (error) {
      return next(error);
    }
  }
};
