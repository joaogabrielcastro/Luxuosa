-- Crediario disponivel para todos os tenants; flag removida.
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "enableCrediario";
