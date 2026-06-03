-- DropColumns
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "enableCommissions";
ALTER TABLE "User" DROP COLUMN IF EXISTS "commissionPercent";
