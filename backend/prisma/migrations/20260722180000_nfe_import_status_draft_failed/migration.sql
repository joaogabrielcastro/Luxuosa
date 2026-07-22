-- AlterEnum: add DRAFT and FAILED to NfeImportStatus
ALTER TYPE "NfeImportStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "NfeImportStatus" ADD VALUE IF NOT EXISTS 'FAILED';
