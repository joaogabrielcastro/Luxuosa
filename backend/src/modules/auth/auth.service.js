import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { authRepository } from "./auth.repository.js";
import { buildTenantFiscalContext } from "../../shared/fiscal/tenantEmitente.js";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function buildAuthResponse(user, tenant) {
  const token = jwt.sign(
    {
      tenant_id: user.tenantId,
      user_type: user.type
    },
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: env.jwtExpiresIn
    }
  );

  const hasNotaasApiKey = Boolean(String(tenant.notaasApiKey || "").trim());
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      type: user.type,
      tenant_id: user.tenantId
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      cnpj: tenant.cnpj,
      plan: tenant.plan,
      enableNfceEmission: tenant.enableNfceEmission,
      notaasProjectId: tenant.notaasProjectId ?? null,
      hasNotaasApiKey,
      stripeSubscriptionStatus: tenant.stripeSubscriptionStatus ?? null,
      planPeriodEnd: tenant.planPeriodEnd ?? null,
      fiscal: buildTenantFiscalContext({ ...tenant, hasNotaasApiKey })
    }
  };
}

export const authService = {
  async login(email, password, tenantCnpj) {
    const users = await authRepository.findUsersWithTenantByEmail(email);
    if (users.length === 0) {
      const err = new Error("Credenciais invalidas.");
      err.statusCode = 401;
      throw err;
    }

    let user;
    if (users.length === 1) {
      user = users[0];
    } else {
      const cnpj = digitsOnly(tenantCnpj);
      if (cnpj.length !== 14) {
        const err = new Error("Varias lojas usam este email. Informe o CNPJ da loja (14 digitos).");
        err.statusCode = 400;
        err.code = "TENANT_CNPJ_REQUIRED";
        throw err;
      }
      user = users.find((u) => digitsOnly(u.tenant.cnpj) === cnpj);
      if (!user) {
        const err = new Error("Credenciais invalidas.");
        err.statusCode = 401;
        throw err;
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const err = new Error("Credenciais invalidas.");
      err.statusCode = 401;
      throw err;
    }

    return buildAuthResponse(user, user.tenant);
  },

  async register({
    tenantName,
    cnpj,
    tenantEmail,
    tenantPhone,
    adminName,
    adminEmail,
    adminPassword
  }) {
    const cnpjDigits = digitsOnly(cnpj);
    if (cnpjDigits.length !== 14) {
      const err = new Error("CNPJ deve ter 14 digitos.");
      err.statusCode = 400;
      throw err;
    }

    const existingTenant = await prisma.tenant.findUnique({ where: { cnpj: cnpjDigits } });
    if (existingTenant) {
      const err = new Error("Ja existe uma loja cadastrada com este CNPJ.");
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    try {
      const { tenant, user } = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: tenantName,
            cnpj: cnpjDigits,
            email: tenantEmail,
            phone: tenantPhone || null,
            plan: "BASIC",
            enableNfceEmission: false
          }
        });

        const existingAdmin = await tx.user.findFirst({
          where: { tenantId: tenant.id, email: adminEmail }
        });
        if (existingAdmin) {
          const err = new Error("Ja existe um administrador com este e-mail nesta loja.");
          err.statusCode = 409;
          throw err;
        }

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: adminName,
            email: adminEmail,
            password: passwordHash,
            type: "ADMIN"
          }
        });

        return { tenant, user };
      });

      return buildAuthResponse(user, tenant);
    } catch (error) {
      if (error.code === "P2002") {
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target.join(",") : String(target || "");
        if (fields.includes("cnpj")) {
          const err = new Error("Ja existe uma loja cadastrada com este CNPJ.");
          err.statusCode = 409;
          throw err;
        }
        if (fields.includes("email")) {
          const err = new Error("Ja existe um administrador com este e-mail nesta loja.");
          err.statusCode = 409;
          throw err;
        }
        const err = new Error("Dados ja cadastrados.");
        err.statusCode = 409;
        throw err;
      }
      throw error;
    }
  },

  async me(tenantId, userId) {
    const [tenant, profile] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          cnpj: true,
          plan: true,
          enableNfceEmission: true,
          notaasProjectId: true,
          notaasApiKey: true,
          stripeSubscriptionStatus: true,
          planPeriodEnd: true
        }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, type: true, tenantId: true }
      })
    ]);
    if (!tenant || !profile) {
      const err = new Error("Sessao invalida.");
      err.statusCode = 401;
      throw err;
    }
    if (profile.tenantId !== tenantId) {
      const err = new Error("Sessao invalida.");
      err.statusCode = 401;
      throw err;
    }
    const hasNotaasApiKey = Boolean(String(tenant.notaasApiKey || "").trim());
    const { notaasApiKey: _secret, ...tenantSafe } = tenant;
    return {
      tenant: {
        ...tenantSafe,
        hasNotaasApiKey,
        fiscal: buildTenantFiscalContext({ ...tenant, hasNotaasApiKey })
      },
      user: profile
    };
  }
};
