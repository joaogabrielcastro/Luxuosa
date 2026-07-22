-- CreateEnum
CREATE TYPE "NfeImportStatus" AS ENUM ('COMPLETED');

-- CreateEnum
CREATE TYPE "NfeImportItemAction" AS ENUM ('LINKED', 'CREATED', 'IGNORED');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT NOT NULL,
    "stateRegistration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSupplierCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSupplierCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfeImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" TEXT,
    "supplierCnpj" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "totalValue" DECIMAL(12,2) NOT NULL,
    "paymentInfo" TEXT,
    "itemCount" INTEGER NOT NULL,
    "status" "NfeImportStatus" NOT NULL DEFAULT 'COMPLETED',
    "userId" TEXT NOT NULL,

    CONSTRAINT "NfeImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfeImportItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nfeImportId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "supplierCode" TEXT,
    "ean" TEXT,
    "description" TEXT NOT NULL,
    "ncm" TEXT,
    "cfop" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "quantityEntered" INTEGER NOT NULL,
    "unitValue" DECIMAL(12,4) NOT NULL,
    "totalValue" DECIMAL(12,2) NOT NULL,
    "productId" TEXT,
    "productVariationId" TEXT,
    "stockMovementId" TEXT,
    "action" "NfeImportItemAction" NOT NULL,

    CONSTRAINT "NfeImportItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "nfeImportId" TEXT;

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_cnpj_key" ON "Supplier"("tenantId", "cnpj");

-- CreateIndex
CREATE INDEX "ProductSupplierCode_tenantId_idx" ON "ProductSupplierCode"("tenantId");

-- CreateIndex
CREATE INDEX "ProductSupplierCode_tenantId_productId_idx" ON "ProductSupplierCode"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSupplierCode_tenantId_supplierId_code_key" ON "ProductSupplierCode"("tenantId", "supplierId", "code");

-- CreateIndex
CREATE INDEX "NfeImport_tenantId_idx" ON "NfeImport"("tenantId");

-- CreateIndex
CREATE INDEX "NfeImport_tenantId_importedAt_idx" ON "NfeImport"("tenantId", "importedAt");

-- CreateIndex
CREATE INDEX "NfeImport_tenantId_supplierId_idx" ON "NfeImport"("tenantId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "NfeImport_tenantId_accessKey_key" ON "NfeImport"("tenantId", "accessKey");

-- CreateIndex
CREATE INDEX "NfeImportItem_tenantId_idx" ON "NfeImportItem"("tenantId");

-- CreateIndex
CREATE INDEX "NfeImportItem_tenantId_nfeImportId_idx" ON "NfeImportItem"("tenantId", "nfeImportId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_nfeImportId_idx" ON "StockMovement"("tenantId", "nfeImportId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_nfeImportId_fkey" FOREIGN KEY ("nfeImportId") REFERENCES "NfeImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplierCode" ADD CONSTRAINT "ProductSupplierCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplierCode" ADD CONSTRAINT "ProductSupplierCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplierCode" ADD CONSTRAINT "ProductSupplierCode_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImport" ADD CONSTRAINT "NfeImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImport" ADD CONSTRAINT "NfeImport_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImport" ADD CONSTRAINT "NfeImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImportItem" ADD CONSTRAINT "NfeImportItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImportItem" ADD CONSTRAINT "NfeImportItem_nfeImportId_fkey" FOREIGN KEY ("nfeImportId") REFERENCES "NfeImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImportItem" ADD CONSTRAINT "NfeImportItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImportItem" ADD CONSTRAINT "NfeImportItem_productVariationId_fkey" FOREIGN KEY ("productVariationId") REFERENCES "ProductVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
