/**
 * Uso: node scripts/e2e-set-plan.mjs <tenantId|email> <BASIC|PRO|ENTERPRISE>
 * Para e2e forçar plano sem API pública de billing.
 *
 * Preferência de DATABASE_URL:
 * 1) env já definida (Playwright passa a URL do host :5434)
 * 2) E2E_DATABASE_URL
 * 3) fallback localhost Docker Compose
 */
import { PrismaClient } from "@prisma/client";

const [, , target, planRaw] = process.argv;
const plan = String(planRaw || "PRO").toUpperCase();
if (!target || !["BASIC", "PRO", "ENTERPRISE"].includes(plan)) {
  console.error("Uso: node scripts/e2e-set-plan.mjs <tenantId|email> <BASIC|PRO|ENTERPRISE>");
  process.exit(1);
}

const hostFallback = "postgresql://postgres:postgres@localhost:5434/luxuosa";
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL || hostFallback;
}

const prisma = new PrismaClient();

try {
  let tenantId = target;
  const looksLikeCuid = /^c[a-z0-9]{20,}$/i.test(target);
  if (!looksLikeCuid) {
    const user = await prisma.user.findFirst({
      where: { email: target },
      select: { tenantId: true }
    });
    if (user) {
      tenantId = user.tenantId;
    } else {
      const digits = target.replace(/\D/g, "");
      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { id: target },
            { email: target },
            ...(digits.length === 14 ? [{ cnpj: digits }] : [])
          ]
        },
        select: { id: true }
      });
      if (!tenant) throw new Error(`Tenant nao encontrado: ${target}`);
      tenantId = tenant.id;
    }
  }

  await prisma.tenant.update({ where: { id: tenantId }, data: { plan } });
  console.log(JSON.stringify({ ok: true, tenantId, plan }));
} finally {
  await prisma.$disconnect();
}
