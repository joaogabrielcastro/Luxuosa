import { z } from "zod";
import { categoryService } from "./category.service.js";

const categorySchema = z.object({
  name: z.string().min(2)
});

export const categoryController = {
  async list(req, res, next) {
    try {
      const categories = await categoryService.list(req.tenantId);
      return res.json(categories);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const category = await categoryService.getById(req.tenantId, req.params.id);
      if (!category) return res.status(404).json({ error: "Categoria nao encontrada." });
      return res.json(category);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = categorySchema.parse(req.body);
      const category = await categoryService.create(req.tenantId, payload);
      return res.status(201).json(category);
    } catch (error) {
      if (error.code === "P2002") return res.status(409).json({ error: "Categoria ja existe." });
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const payload = categorySchema.partial().parse(req.body);
      await categoryService.update(req.tenantId, req.params.id, payload);
      return res.status(204).send();
    } catch (error) {
      if (error.code === "P2002") return res.status(409).json({ error: "Categoria ja existe." });
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await categoryService.remove(req.tenantId, req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
};
