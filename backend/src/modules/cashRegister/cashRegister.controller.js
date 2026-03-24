import { z } from "zod";
import { CashMovementType } from "@prisma/client";
import { cashRegisterService } from "./cashRegister.service.js";

const openSchema = z.object({
  initialValue: z.coerce.number().nonnegative()
});

const movementSchema = z.object({
  type: z.nativeEnum(CashMovementType),
  value: z.coerce.number().positive(),
  description: z.string().optional()
});

const closeSchema = z.object({
  finalValue: z.coerce.number().nonnegative()
});

export const cashRegisterController = {
  async current(req, res, next) {
    try {
      const cashRegister = await cashRegisterService.current(req.tenantId);
      return res.json(cashRegister);
    } catch (error) {
      return next(error);
    }
  },

  async open(req, res, next) {
    try {
      const payload = openSchema.parse(req.body);
      const cashRegister = await cashRegisterService.open(req.tenantId, req.user.id, payload.initialValue);
      return res.status(201).json(cashRegister);
    } catch (error) {
      return next(error);
    }
  },

  async addMovement(req, res, next) {
    try {
      const payload = movementSchema.parse(req.body);
      const movement = await cashRegisterService.addMovement(req.tenantId, req.params.id, payload);
      return res.status(201).json(movement);
    } catch (error) {
      return next(error);
    }
  },

  async close(req, res, next) {
    try {
      const payload = closeSchema.parse(req.body);
      const cashRegister = await cashRegisterService.close(req.tenantId, req.params.id, payload.finalValue);
      return res.json(cashRegister);
    } catch (error) {
      return next(error);
    }
  }
};
