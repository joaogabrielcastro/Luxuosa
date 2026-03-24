import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d"
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET nao configurado.");
}
