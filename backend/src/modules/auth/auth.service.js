import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { authRepository } from "./auth.repository.js";

export const authService = {
  async login(email, password) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      const err = new Error("Credenciais invalidas.");
      err.statusCode = 401;
      throw err;
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
