-- CreateEnum
CREATE TYPE "NfceIssueJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "emissionStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NfceIssueJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "status" "NfceIssueJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfceIssueJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfceIssueJob_saleId_key" ON "NfceIssueJob"("saleId");
CREATE INDEX "NfceIssueJob_tenantId_idx" ON "NfceIssueJob"("tenantId");
CREATE INDEX "NfceIssueJob_tenantId_status_idx" ON "NfceIssueJob"("tenantId", "status");
CREATE INDEX "NfceIssueJob_tenantId_runAt_idx" ON "NfceIssueJob"("tenantId", "runAt");

ALTER TABLE "NfceIssueJob" ADD CONSTRAINT "NfceIssueJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
