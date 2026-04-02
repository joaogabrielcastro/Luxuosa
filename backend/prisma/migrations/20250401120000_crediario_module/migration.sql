-- CreateEnum
CREATE TYPE "CreditSaleStatus" AS ENUM ('OPEN', 'PAID', 'CANCELED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "enableCrediario" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CreditSale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalValue" DECIMAL(12,2) NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "paidTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CreditSaleStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditSaleItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creditSaleId" TEXT NOT NULL,
    "productVariationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "CreditSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creditSaleId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "CreditPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditSale_tenantId_idx" ON "CreditSale"("tenantId");
CREATE INDEX "CreditSale_tenantId_customerId_idx" ON "CreditSale"("tenantId", "customerId");
CREATE INDEX "CreditSale_tenantId_occurredAt_idx" ON "CreditSale"("tenantId", "occurredAt");
CREATE INDEX "CreditSale_tenantId_status_idx" ON "CreditSale"("tenantId", "status");

CREATE INDEX "CreditSaleItem_tenantId_idx" ON "CreditSaleItem"("tenantId");
CREATE INDEX "CreditSaleItem_tenantId_creditSaleId_idx" ON "CreditSaleItem"("tenantId", "creditSaleId");

CREATE INDEX "CreditPayment_tenantId_idx" ON "CreditPayment"("tenantId");
CREATE INDEX "CreditPayment_tenantId_creditSaleId_idx" ON "CreditPayment"("tenantId", "creditSaleId");

-- AddForeignKey
ALTER TABLE "CreditSale" ADD CONSTRAINT "CreditSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditSale" ADD CONSTRAINT "CreditSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditSale" ADD CONSTRAINT "CreditSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditSaleItem" ADD CONSTRAINT "CreditSaleItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditSaleItem" ADD CONSTRAINT "CreditSaleItem_creditSaleId_fkey" FOREIGN KEY ("creditSaleId") REFERENCES "CreditSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditSaleItem" ADD CONSTRAINT "CreditSaleItem_productVariationId_fkey" FOREIGN KEY ("productVariationId") REFERENCES "ProductVariation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditPayment" ADD CONSTRAINT "CreditPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditPayment" ADD CONSTRAINT "CreditPayment_creditSaleId_fkey" FOREIGN KEY ("creditSaleId") REFERENCES "CreditSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
