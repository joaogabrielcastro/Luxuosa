-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "stockAlertsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "stockAlertEmail" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "stockAlertPhone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "stockAlertMinSeverity" TEXT NOT NULL DEFAULT 'low';
ALTER TABLE "Tenant" ADD COLUMN "stockAlertCooldownMin" INTEGER NOT NULL DEFAULT 1440;

-- CreateTable
CREATE TABLE "StockAlertLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "productId" TEXT,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockAlertLog_tenantId_createdAt_idx" ON "StockAlertLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAlertLog_tenantId_productId_channel_idx" ON "StockAlertLog"("tenantId", "productId", "channel");

-- AddForeignKey
ALTER TABLE "StockAlertLog" ADD CONSTRAINT "StockAlertLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
