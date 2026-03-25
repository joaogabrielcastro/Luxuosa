import { z } from "zod";
import { stockMovementService } from "./stockMovement.service.js";

const createSchema = z.object({
  productVariationId: z.string().min(1),
  type: z.enum(["ENTRY", "EXIT"]),
  quantity: z.coerce.number().int().positive()
});

export const stockMovementController = {
  async list(req, res, next) {
    try {
      const take = req.query.take ? Number(req.query.take) : undefined;
      const data = await stockMovementService.list(req.tenantId, { take });
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const body = createSchema.parse(req.body);
      const created = await stockMovementService.create(req.tenantId, body);
      return res.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  }
};
