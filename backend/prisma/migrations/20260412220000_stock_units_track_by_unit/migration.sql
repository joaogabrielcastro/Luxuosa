-- CreateEnum
CREATE TYPE "StockUnitStatus" AS ENUM ('AVAILABLE', 'SOLD');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "trackByUnit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StockUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productVariationId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "notes" TEXT,
    "status" "StockUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockUnit_tenantId_barcode_key" ON "StockUnit"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "StockUnit_tenantId_idx" ON "StockUnit"("tenantId");

-- CreateIndex
CREATE INDEX "StockUnit_tenantId_productVariationId_idx" ON "StockUnit"("tenantId", "productVariationId");

-- CreateIndex
CREATE INDEX "StockUnit_tenantId_status_idx" ON "StockUnit"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "StockUnit" ADD CONSTRAINT "StockUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockUnit" ADD CONSTRAINT "StockUnit_productVariationId_fkey" FOREIGN KEY ("productVariationId") REFERENCES "ProductVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "stockUnitId" TEXT;

-- AlterTable
ALTER TABLE "CreditSaleItem" ADD COLUMN "stockUnitId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_stockUnitId_key" ON "SaleItem"("stockUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditSaleItem_stockUnitId_key" ON "CreditSaleItem"("stockUnitId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "StockUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSaleItem" ADD CONSTRAINT "CreditSaleItem_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "StockUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
