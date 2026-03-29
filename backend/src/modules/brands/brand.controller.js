import { z } from "zod";
import { brandService } from "./brand.service.js";

const brandSchema = z.object({
  name: z.string().min(2)
});

export const brandController = {
  async list(req, res, next) {
    try {
      const brands = await brandService.list(req.tenantId);
      return res.json(brands);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const brand = await brandService.getById(req.tenantId, req.params.id);
      if (!brand) return res.status(404).json({ error: "Marca nao encontrada." });
      return res.json(brand);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = brandSchema.parse(req.body);
      const brand = await brandService.create(req.tenantId, payload);
      return res.status(201).json(brand);
    } catch (error) {
      if (error.code === "P2002") return res.status(409).json({ error: "Marca ja cadastrada." });
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const payload = brandSchema.partial().parse(req.body);
      await brandService.update(req.tenantId, req.params.id, payload);
      return res.status(204).send();
    } catch (error) {
      if (error.code === "P2002") return res.status(409).json({ error: "Marca ja cadastrada." });
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await brandService.remove(req.tenantId, req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
};
