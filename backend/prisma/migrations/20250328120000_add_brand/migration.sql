-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_tenantId_name_key" ON "Brand"("tenantId", "name");
CREATE INDEX "Brand_tenantId_idx" ON "Brand"("tenantId");

ALTER TABLE "Brand" ADD CONSTRAINT "Brand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "brandId" TEXT;

INSERT INTO "Brand" ("id", "tenantId", "name", "createdAt")
SELECT 'brand_default_' || "id", "id", 'Geral', CURRENT_TIMESTAMP
FROM "Tenant";

UPDATE "Product" AS p
SET "brandId" = 'brand_default_' || p."tenantId"
WHERE p."brandId" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "brandId" SET NOT NULL;

CREATE INDEX "Product_tenantId_brandId_idx" ON "Product"("tenantId", "brandId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
