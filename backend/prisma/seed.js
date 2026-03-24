import bcrypt from "bcryptjs";
import { PrismaClient, Plan, UserType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenantCnpj = "12345678000199";
  const adminEmail = "admin@luxuosa.com";
  const adminPasswordPlain = "123456";

  const tenant = await prisma.tenant.upsert({
    where: { cnpj: tenantCnpj },
    update: {
      name: "Luxuosa Loja Demo",
      email: "contato@luxuosa.com",
      phone: "11999999999",
      plan: Plan.BASIC
    },
    create: {
      name: "Luxuosa Loja Demo",
      cnpj: tenantCnpj,
      email: "contato@luxuosa.com",
      phone: "11999999999",
      plan: Plan.BASIC
    }
  });

  const passwordHash = await bcrypt.hash(adminPasswordPlain, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Administrador",
      password: passwordHash,
      tenantId: tenant.id,
      type: UserType.ADMIN
    },
    create: {
      name: "Administrador",
      email: adminEmail,
      password: passwordHash,
      tenantId: tenant.id,
      type: UserType.ADMIN
    }
  });

  console.log("Seed concluido com sucesso.");
  console.log(`Email: ${adminEmail}`);
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
