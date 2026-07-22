/**
 * Preload: deve rodar antes de importar app/prisma (node --import).
 * Uso: node --import ./src/test/setupEnv.js --test ...
 *
 * Forca DATABASE_URL de teste (Docker host :5434) para nao herdar
 * backend/.env apontando para outra instancia (ex.: :5432).
 * Override: TEST_DATABASE_URL.
 */
import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-luxuosa-integration";
}

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5434/luxuosa";

/** Evita processar NFC-e no processo de teste. */
process.env.NFCE_PROCESS_IN_API = "false";

/** Mock Nuvem Fiscal por padrao nos testes de integracao. */
if (process.env.NFCE_MOCK == null || process.env.NFCE_MOCK === "") {
  process.env.NFCE_MOCK = "true";
}

/** Nao exige CORS_ORIGINS nos testes. */
if (process.env.NODE_ENV === "production") {
  process.env.NODE_ENV = "test";
}
