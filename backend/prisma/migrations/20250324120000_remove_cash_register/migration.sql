-- DropForeignKey
ALTER TABLE "CashMovement" DROP CONSTRAINT "CashMovement_cashRegisterId_fkey";

-- DropForeignKey
ALTER TABLE "CashMovement" DROP CONSTRAINT "CashMovement_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CashRegister" DROP CONSTRAINT "CashRegister_tenantId_fkey";

-- DropTable
DROP TABLE "CashMovement";

-- DropTable
DROP TABLE "CashRegister";

-- DropEnum
DROP TYPE "CashMovementType";

-- DropEnum
DROP TYPE "CashRegisterStatus";
