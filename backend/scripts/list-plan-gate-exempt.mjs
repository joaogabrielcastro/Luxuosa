import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tenants = await prisma.tenant.findMany({
  select: {
    id: true,
    name: true,
    cnpj: true,
    email: true,
    plan: true,
    planGateExempt: true,
    createdAt: true
  },
  orderBy: { createdAt: "asc" }
});

const exempt = tenants.filter((t) => t.planGateExempt);
const gated = tenants.filter((t) => !t.planGateExempt);

console.log("=== ISENTOS (planGateExempt=true) ===");
for (const t of exempt) {
  console.log(
    `- ${t.name} | CNPJ ${t.cnpj} | ${t.email} | plano ${t.plan} | criado ${t.createdAt.toISOString().slice(0, 10)}`
  );
}
console.log(`Total isentos: ${exempt.length}`);

console.log("\n=== COM GATE (planGateExempt=false) ===");
for (const t of gated) {
  console.log(
    `- ${t.name} | CNPJ ${t.cnpj} | ${t.email} | plano ${t.plan} | criado ${t.createdAt.toISOString().slice(0, 10)}`
  );
}
console.log(`Total com gate: ${gated.length}`);
console.log(`\nTotal lojas: ${tenants.length}`);

await prisma.$disconnect();
