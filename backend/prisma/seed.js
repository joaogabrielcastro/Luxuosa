import bcrypt from "bcryptjs";
import { PrismaClient, Plan, UserType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenantsSeed = [
    {
      name: "Luxuosa Loja Demo",
      cnpj: "12345678000199",
      email: "contato@luxuosa.com",
      phone: "11999999999",
      users: [{ name: "Administrador", email: "admin@luxuosa.com" }]
    },
    {
      name: "Mariana Pavin Store",
      cnpj: "11111111000191",
      email: "marianapavin@admin.com",
      phone: "11911111111",
      users: [{ name: "Mariana Pavin", email: "marianapavin@admin.com" }]
    },
    {
      name: "Marisa Fernandes Store",
      cnpj: "22222222000191",
      email: "marisafernandes@admin.com",
      phone: "11922222222",
      users: [{ name: "Marisa Fernandes", email: "marisafernandes@admin.com" }]
    }
  ];
  const adminPasswordPlain = "123456";
  const passwordHash = await bcrypt.hash(adminPasswordPlain, 10);

  for (const tenantCfg of tenantsSeed) {
    const tenant = await prisma.tenant.upsert({
      where: { cnpj: tenantCfg.cnpj },
      update: {
        name: tenantCfg.name,
        email: tenantCfg.email,
        phone: tenantCfg.phone,
        plan: Plan.BASIC
      },
      create: {
        name: tenantCfg.name,
        cnpj: tenantCfg.cnpj,
        email: tenantCfg.email,
        phone: tenantCfg.phone,
        plan: Plan.BASIC
      }
    });

    for (const adminUser of tenantCfg.users) {
      // Garante isolamento sem ambiguidade de login por email.
      await prisma.user.deleteMany({
        where: {
          email: adminUser.email,
          tenantId: { not: tenant.id }
        }
      });

      await prisma.user.upsert({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: adminUser.email
          }
        },
        update: {
          name: adminUser.name,
          password: passwordHash,
          tenantId: tenant.id,
          type: UserType.ADMIN
        },
        create: {
          name: adminUser.name,
          email: adminUser.email,
          password: passwordHash,
          tenantId: tenant.id,
          type: UserType.ADMIN
        }
      });
    }
  }

  console.log("Seed concluido com sucesso.");
  console.log(
    `Emails: ${tenantsSeed
      .flatMap((t) => t.users.map((u) => u.email))
      .join(", ")}`
  );
  console.log(`Senha: ${adminPasswordPlain}`);
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
