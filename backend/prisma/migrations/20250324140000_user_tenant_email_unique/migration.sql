-- DropIndex
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
