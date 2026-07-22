-- Stripe billing fields on Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeSubscriptionStatus" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "planPeriodEnd" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeSubscriptionId_key" ON "Tenant"("stripeSubscriptionId");
