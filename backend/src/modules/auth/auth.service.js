import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { authRepository } from "./auth.repository.js";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
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
        id: user.tenant.id,
        name: user.tenant.name,
        plan: user.tenant.plan
      }
    };
  }
};
