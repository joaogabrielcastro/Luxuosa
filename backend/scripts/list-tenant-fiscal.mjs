/**
 * Lista todas as lojas (tenants) e o CNPJ / Notaas que cada uma usaria na NFC-e.
 * Rode no servidor: npm run fiscal:list-tenants
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { buildTenantFiscalContext, formatCnpjBr } from "../src/shared/nuvemFiscal/nuvemFiscalEmitente.js";
import { env } from "../src/config/env.js";

dotenv.config();

const prisma = new PrismaClient();

function maskKey(key) {
  const k = String(key || "").trim();
  if (!k) return "—";
  if (k.length <= 12) return `${k.slice(0, 4)}…`;
  return `${k.slice(0, 10)}…${k.slice(-4)}`;
}

async function main() {
  console.log("\n=== Auditoria fiscal multi-tenant (Notaas) ===\n");
  console.log(`NOTAAS_API_BASE: ${env.notaas.apiBase}`);
  console.log(`NOTAAS_AMBIENTE: ${env.notaas.ambiente}\n`);

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      cnpj: true,
      enableNfceEmission: true,
      email: true,
      notaasProjectId: true,
      notaasApiKey: true
    }
  });

  if (!tenants.length) {
    console.log("Nenhum tenant cadastrado.");
    return;
  }

  console.log("Loja | CNPJ | NFC-e | Notaas key | Projeto");
  console.log("-".repeat(100));

  for (const t of tenants) {
    const f = buildTenantFiscalContext(t);
    console.log(
      [
        t.name.slice(0, 22).padEnd(22),
        formatCnpjBr(t.cnpj).padEnd(20),
        f.enableNfceEmission ? "sim".padEnd(5) : "nao".padEnd(5),
        maskKey(t.notaasApiKey).padEnd(22),
        String(t.notaasProjectId || "—").slice(0, 16)
      ].join(" | ")
    );
  }

  const withNfce = tenants.filter((t) => Boolean(t.enableNfceEmission));
  const withKey = withNfce.filter((t) => String(t.notaasApiKey || "").trim());
  const emitentesNfce = new Set(
    withNfce
      .map((t) => buildTenantFiscalContext(t).emitenteCnpj)
      .filter((c) => c && c.length === 14)
  );
  console.log(`\nLojas com NFC-e ativa: ${withNfce.length}`);
  console.log(`Com API Key Notaas: ${withKey.length}`);
  console.log(`CNPJs distintos entre elas: ${emitentesNfce.size}`);
  if (withNfce.length > withKey.length) {
    console.warn("AVISO: lojas com NFC-e ativa sem notaasApiKey — emissao real vai falhar.");
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
