import { z } from "zod";
import { userService } from "./user.service.js";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  type: z.enum(["ADMIN", "ATTENDANT"])
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["ADMIN", "ATTENDANT"]).optional(),
  password: z.string().min(6).optional()
});

export const userController = {
  async list(req, res, next) {
    try {
      const users = await userService.list(req.tenantId);
      return res.json(users);
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      const payload = createUserSchema.parse(req.body);
      const user = await userService.create(req.tenantId, payload);
      return res.status(201).json(user);
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const payload = updateUserSchema.parse(req.body);
      await userService.update(req.tenantId, req.params.id, payload, req.user.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await userService.remove(req.tenantId, req.params.id, req.user.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
};
