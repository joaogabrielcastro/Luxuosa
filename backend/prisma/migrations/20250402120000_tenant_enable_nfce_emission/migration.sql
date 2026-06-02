-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "enableNfceEmission" BOOLEAN NOT NULL DEFAULT false;

-- Apenas a loja demo Luxuosa (CNPJ do seed) emite NFC-e com o emitente configurado no .env
UPDATE "Tenant" SET "enableNfceEmission" = true WHERE "cnpj" = '12345678000199';
