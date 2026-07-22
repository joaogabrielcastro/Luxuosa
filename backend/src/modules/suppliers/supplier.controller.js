import { z } from "zod";
import { supplierService } from "./supplier.service.js";

const supplierSchema = z.object({
  name: z.string().min(2).max(200),
  tradeName: z.string().max(200).optional().nullable(),
  cnpj: z.string().min(14).max(18),
  stateRegistration: z.string().max(30).optional().nullable()
});

const supplierUpdateSchema = supplierSchema.partial();

export const supplierController = {
  async list(req, res, next) {
    try {
      const items = await supplierService.list(req.tenantId);
      return res.json(items);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const item = await supplierService.getById(req.tenantId, req.params.id);
      if (!item) return res.status(404).json({ error: "Fornecedor nao encontrado." });
      return res.json(item);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = supplierSchema.parse(req.body);
      const item = await supplierService.create(req.tenantId, payload);
      return res.status(201).json(item);
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const payload = supplierUpdateSchema.parse(req.body);
      await supplierService.update(req.tenantId, req.params.id, payload);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
};
