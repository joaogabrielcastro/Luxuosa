import { z } from "zod";
import { productVariationService } from "./productVariation.service.js";

const variationSchema = z.object({
  productId: z.string().min(1),
  size: z.string().min(1),
  color: z.string().min(1),
  stock: z.coerce.number().int().nonnegative()
});

export const productVariationController = {
  async list(req, res, next) {
    try {
      const variations = await productVariationService.list(req.tenantId);
      return res.json(variations);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const variation = await productVariationService.getById(req.tenantId, req.params.id);
      if (!variation) return res.status(404).json({ error: "Variacao nao encontrada." });
      return res.json(variation);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = variationSchema.parse(req.body);
      const variation = await productVariationService.create(req.tenantId, payload);
      return res.status(201).json(variation);
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "Variacao ja cadastrada para este produto." });
      }
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const payload = variationSchema.partial().parse(req.body);
      await productVariationService.update(req.tenantId, req.params.id, payload);
      return res.status(204).send();
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "Variacao ja cadastrada para este produto." });
      }
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await productVariationService.remove(req.tenantId, req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
};
