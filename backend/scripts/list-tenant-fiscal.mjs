/**
 * Lista todas as lojas (tenants) e o CNPJ que cada uma usaria na NFC-e.
 * Rode no servidor: npm run fiscal:list-tenants
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { buildTenantFiscalContext, formatCnpjBr } from "../src/shared/nuvemFiscal/nuvemFiscalEmitente.js";
import { env } from "../src/config/env.js";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const envCnpj = String(env.nuvemFiscal.emitenteCnpj || "").replace(/\D/g, "");
  console.log("\n=== Auditoria fiscal multi-tenant ===\n");
  if (envCnpj.length === 14) {
    console.log(
      `NUVEM_FISCAL_EMITENTE_CNPJ no .env: ${formatCnpjBr(envCnpj)} (só usado se o tenant não tiver CNPJ válido)\n`
    );
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: { name: true, cnpj: true, enableNfceEmission: true, email: true }
  });

  if (!tenants.length) {
    console.log("Nenhum tenant cadastrado.");
    return;
  }

  console.log("Loja | CNPJ cadastro | NFC-e ativa | CNPJ na emissão | Origem");
  console.log("-".repeat(90));

  for (const t of tenants) {
    const f = buildTenantFiscalContext(t);
    console.log(
      [
        t.name.slice(0, 22).padEnd(22),
        formatCnpjBr(t.cnpj).padEnd(20),
        f.enableNfceEmission ? "sim".padEnd(11) : "nao".padEnd(11),
        (f.emitenteCnpjFormatado || "—").padEnd(20),
        f.emitenteSource
      ].join(" | ")
    );
  }

  const withNfce = tenants.filter((t) => Boolean(t.enableNfceEmission));
  const emitentesNfce = new Set(
    withNfce.map((t) => buildTenantFiscalContext(t).emitCnpj).filter((c) => c && c.length === 14)
  );
  console.log(`\nLojas com NFC-e ativa: ${withNfce.length}`);
  console.log(`CNPJs distintos entre elas: ${emitentesNfce.size}`);
  if (withNfce.length > 0 && emitentesNfce.size < withNfce.length) {
    console.warn(
      "AVISO: varias lojas com NFC-e ativa mas mesmo CNPJ emitente — revise Tenant.cnpj no banco."
    );
  }
  if (withNfce.length > 0 && emitentesNfce.size === withNfce.length) {
    console.log("OK: cada loja com NFC-e ativa usa um CNPJ de emissão distinto.");
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
