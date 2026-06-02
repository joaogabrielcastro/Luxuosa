import { z } from "zod";
import { authService } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantCnpj: z.string().optional()
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

  logout(_req, res) {
    return res.status(204).send();
  },

  async me(req, res, next) {
    try {
      const { tenant, profile } = await authService.me(req.tenantId, req.user.id);
      return res.json({
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          type: profile.type,
          tenant_id: profile.tenantId
        },
        tenant
      });
    } catch (error) {
      return next(error);
    }
  }
};
