import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { planMaxUsers } from "../../shared/planCatalog.js";
import { userRepository, userPublicSelect } from "./user.repository.js";

export const userService = {
  list(tenantId) {
    return userRepository.listByTenant(tenantId);
  },

  getById(tenantId, id) {
    return userRepository.findPublicById(tenantId, id);
  },

  async create(tenantId, { name, email, password, type }) {
    const existing = await userRepository.findByEmail(tenantId, email);
    if (existing) {
      const err = new Error("Ja existe um usuario com este e-mail nesta loja.");
      err.statusCode = 409;
      throw err;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, planGateExempt: true }
    });
    if (!tenant) {
      const err = new Error("Loja nao encontrada.");
      err.statusCode = 404;
      throw err;
    }
    const maxUsers = planMaxUsers(tenant);
    if (maxUsers != null) {
      const count = await userRepository.countByTenant(tenantId);
      if (count >= maxUsers) {
        const err = new Error(
          `Limite de ${maxUsers} usuarios neste plano. Atualize em Assinatura.`
        );
        err.statusCode = 402;
        err.code = "PLAN_UPGRADE_REQUIRED";
        throw err;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    return userRepository.create(
      tenantId,
      {
        name,
        email,
        password: passwordHash,
        type
      },
      { select: userPublicSelect }
    );
  },

  async update(tenantId, id, payload, _actorUserId) {
    const current = await userRepository.findUniqueById(tenantId, id);
    if (!current) {
      const err = new Error("Usuario nao encontrado.");
      err.statusCode = 404;
      throw err;
    }

    const data = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.type !== undefined) data.type = payload.type;
    if (payload.password) {
      data.password = await bcrypt.hash(payload.password, 10);
    }

    if (payload.type === "ATTENDANT" && current.type === "ADMIN") {
      const otherAdmins = await userRepository.countAdmins(tenantId, current.id);
      if (otherAdmins === 0) {
        const err = new Error("Nao e possivel rebaixar o ultimo administrador da loja.");
        err.statusCode = 409;
        throw err;
      }
    }

    const result = await userRepository.update(tenantId, id, data);
    if (result.count === 0) {
      const err = new Error("Usuario nao encontrado.");
      err.statusCode = 404;
      throw err;
    }

    return userRepository.findPublicById(tenantId, id);
  },

  async remove(tenantId, id, actorUserId) {
    if (id === actorUserId) {
      const err = new Error("Nao e possivel excluir o proprio usuario.");
      err.statusCode = 409;
      throw err;
    }

    const current = await userRepository.findUniqueById(tenantId, id);
    if (!current) {
      const err = new Error("Usuario nao encontrado.");
      err.statusCode = 404;
      throw err;
    }

    if (current.type === "ADMIN") {
      const otherAdmins = await userRepository.countAdmins(tenantId, current.id);
      if (otherAdmins === 0) {
        const err = new Error("Nao e possivel excluir o ultimo administrador da loja.");
        err.statusCode = 409;
        throw err;
      }
    }

    const result = await userRepository.delete(tenantId, id);
    if (result.count === 0) {
      const err = new Error("Usuario nao encontrado.");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }
};
