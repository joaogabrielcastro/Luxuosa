-- Isencao de gate de plano para clientes ja existentes (grandfathering).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "planGateExempt" BOOLEAN NOT NULL DEFAULT false;

-- Todos os tenants atuais liberados; novos cadastros (self-serve) nascem com false.
UPDATE "Tenant" SET "planGateExempt" = true;
