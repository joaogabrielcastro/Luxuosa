import { z } from "zod";
import { authService } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const authController = {
  async login(req, res, next) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data.email, data.password);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  logout(_req, res) {
    return res.status(204).send();
  },

  me(req, res) {
    return res.json({ user: req.user });
  }
};
