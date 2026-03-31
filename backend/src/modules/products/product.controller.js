import { z } from "zod";
import { parsePageQuery } from "../../shared/pagination.js";
import { productService } from "./product.service.js";

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  cost: z.coerce.number().nonnegative(),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  sku: z.string().min(2),
  minStock: z.coerce.number().int().nonnegative(),
  ncm: z.string().regex(/^\d{8}$/).optional(),
  cfop: z.string().regex(/^\d{4}$/).optional(),
  icmsOrig: z.coerce.number().int().min(0).max(8).optional(),
  icmsCsosn: z.string().min(3).max(4).optional()
});

export const productController = {
  async list(req, res, next) {
    try {
      const hasPaging = req.query.take !== undefined || req.query.skip !== undefined;
      if (hasPaging) {
        const { take, skip } = parsePageQuery(req.query, { defaultTake: 50, maxTake: 200 });
        const q = req.query.q ? String(req.query.q).trim() : undefined;
        const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
        const brandId = req.query.brandId ? String(req.query.brandId) : undefined;
        const paged = await productService.listPaged(req.tenantId, { take, skip, q, categoryId, brandId });
        return res.json(paged);
      }
      const products = await productService.list(req.tenantId);
      return res.json(products);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const product = await productService.getById(req.tenantId, req.params.id);
      if (!product) return res.status(404).json({ error: "Produto nao encontrado." });
      return res.json(product);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = productSchema.parse(req.body);
      const product = await productService.create(req.tenantId, payload);
      return res.status(201).json(product);
    } catch (error) {
      if (error.code === "P2002") return res.status(409).json({ error: "SKU ja cadastrado." });
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const payload = productSchema.partial().parse(req.body);
      await productService.update(req.tenantId, req.params.id, payload);
      return res.status(204).send();
    } catch (error) {
      if (error.code === "P2002") return res.status(409).json({ error: "SKU ja cadastrado." });
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await productService.remove(req.tenantId, req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },

  async lowStock(req, res, next) {
    try {
      const items = await productService.lowStock(req.tenantId);
      return res.json(items);
    } catch (error) {
      return next(error);
    }
  }
};
