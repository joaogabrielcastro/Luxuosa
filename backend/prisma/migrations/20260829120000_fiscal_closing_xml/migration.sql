-- Persistir XML de NFC-e emitidas e NF-e de entrada para fechamento mensal / export contabil.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "xmlContent" TEXT;
ALTER TABLE "NfeImport" ADD COLUMN IF NOT EXISTS "xmlContent" TEXT;
