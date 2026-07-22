import { z } from "zod";
import { authService } from "./auth.service.js";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantCnpj: z.string().optional()
});

const registerSchema = z.object({
  tenantName: z.string().min(2),
  cnpj: z
    .string()
    .transform((v) => digitsOnly(v))
    .refine((v) => v.length === 14, { message: "CNPJ deve ter 14 digitos." }),
  tenantEmail: z.string().email(),
  tenantPhone: z.string().optional(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6)
});

export const authController = {
  async login(req, res, next) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data.email, data.password, data.tenantCnpj);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async register(req, res, next) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  logout(_req, res) {
    return res.status(204).send();
  },

  async me(req, res, next) {
    try {
      const { tenant, user } = await authService.me(req.tenantId, req.user.id);
      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          type: user.type,
          tenant_id: user.tenantId
        },
        tenant
      });
    } catch (error) {
      return next(error);
    }
  }
};
