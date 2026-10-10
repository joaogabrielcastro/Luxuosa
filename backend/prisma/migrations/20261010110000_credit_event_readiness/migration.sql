ALTER TABLE "Tenant"
  ADD COLUMN "creditEventMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "creditEventOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "creditEventName" TEXT,
  ADD COLUMN "creditEventDueDate" TIMESTAMP(3),
  ADD COLUMN "creditEventClosedAt" TIMESTAMP(3),
  ADD COLUMN "creditDefaultLimit" DECIMAL(12,2);

ALTER TABLE "Customer"
  ADD COLUMN "eventCode" TEXT,
  ADD COLUMN "creditLimit" DECIMAL(12,2);

ALTER TABLE "CreditSale"
  ADD COLUMN "eventName" TEXT,
  ADD COLUMN "dueDate" TIMESTAMP(3);

CREATE INDEX "Customer_tenantId_phone_idx" ON "Customer"("tenantId", "phone");
CREATE UNIQUE INDEX "Customer_tenantId_eventCode_key" ON "Customer"("tenantId", "eventCode");
