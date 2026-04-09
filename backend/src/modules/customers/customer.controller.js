import { z } from "zod";
import { customerService } from "./customer.service.js";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** null = sem documento; senao 11 (CPF) ou 14 (CNPJ) digitos. */
const cpfCnpjSchema = z
  .preprocess((v) => {
    const d = digitsOnly(v);
    return d.length === 0 ? null : d;
  }, z.union([z.null(), z.string()]))
  .refine((v) => v === null || v.length === 11 || v.length === 14, {
    message: "CPF (11 digitos), CNPJ (14 digitos) ou em branco."
  });

const customerSchema = z.object({
  name: z.string().min(2),
  cpfCnpj: cpfCnpjSchema,
  phone: z.string().min(8).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  uf: z.string().length(2).optional(),
  cep: z.string().min(8).optional(),
  ibgeMunicipio: z.string().length(7).optional(),
  municipioNome: z.string().min(2).optional()
});

export const customerController = {
  async list(req, res, next) {
    try {
      const customers = await customerService.list(req.tenantId);
      return res.json(customers);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const customer = await customerService.getById(req.tenantId, req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Cliente nao encontrado." });
      }
      return res.json(customer);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = customerSchema.parse(req.body);
      const customer = await customerService.create(req.tenantId, payload);
      return res.status(201).json(customer);
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const payload = customerSchema.partial().parse(req.body);
      await customerService.update(req.tenantId, req.params.id, payload);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await customerService.remove(req.tenantId, req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
};
