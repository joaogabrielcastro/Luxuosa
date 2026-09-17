-- AlterTable
ALTER TABLE "ProductVariation" ADD COLUMN "sku" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariation_tenantId_sku_key" ON "ProductVariation"("tenantId", "sku");
