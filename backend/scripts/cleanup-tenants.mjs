import { PrismaClient, Plan } from "@prisma/client";

const prisma = new PrismaClient();

const FERNANDO_CNPJ = "33333333000191";
const MARIANA_CNPJ = "11111111000191";

/**
 * Remove tenant e dados relacionados (FKs sem onDelete Cascade).
 * @param {string} tenantId
 */
async function deleteTenantCascade(tenantId) {
  await prisma.$transaction(async (tx) => {
    await tx.stockAlertLog.deleteMany({ where: { tenantId } });
    await tx.creditPayment.deleteMany({ where: { tenantId } });
    await tx.creditSaleItem.deleteMany({ where: { tenantId } });
    await tx.creditSale.deleteMany({ where: { tenantId } });
    await tx.saleItem.deleteMany({ where: { tenantId } });
    await tx.invoice.deleteMany({ where: { tenantId } });
    await tx.nfceIssueJob.deleteMany({ where: { tenantId } });
    await tx.sale.deleteMany({ where: { tenantId } });
    await tx.cashSession.deleteMany({ where: { tenantId } });
    await tx.stockMovement.deleteMany({ where: { tenantId } });
    await tx.nfeImportItem.deleteMany({ where: { tenantId } });
    await tx.nfeImport.deleteMany({ where: { tenantId } });
    await tx.productSupplierCode.deleteMany({ where: { tenantId } });
    await tx.supplier.deleteMany({ where: { tenantId } });
    await tx.productVariation.deleteMany({ where: { tenantId } });
    await tx.product.deleteMany({ where: { tenantId } });
    await tx.brand.deleteMany({ where: { tenantId } });
    await tx.category.deleteMany({ where: { tenantId } });
    await tx.customer.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });
}

const fernando = await prisma.tenant.findUnique({ where: { cnpj: FERNANDO_CNPJ } });
if (!fernando) {
  console.log(`Fernando Store nao encontrado (${FERNANDO_CNPJ})`);
} else {
  await deleteTenantCascade(fernando.id);
  console.log(`Excluido: ${fernando.name} (${FERNANDO_CNPJ})`);
}

const mariana = await prisma.tenant.updateMany({
  where: { cnpj: MARIANA_CNPJ },
  data: { plan: Plan.PRO, planGateExempt: true }
});
console.log(`Mariana Pavin Store → PRO (rows: ${mariana.count})`);

const left = await prisma.tenant.findMany({
  select: { name: true, cnpj: true, email: true, plan: true, planGateExempt: true },
  orderBy: { name: "asc" }
});
console.log("\nLojas:");
for (const t of left) {
  console.log(`- ${t.name} | ${t.cnpj} | ${t.plan} | exempt=${t.planGateExempt}`);
}

await prisma.$disconnect();
