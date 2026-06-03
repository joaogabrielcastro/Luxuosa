-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "enableCommissions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "commissionPercent" DECIMAL(5,2);
