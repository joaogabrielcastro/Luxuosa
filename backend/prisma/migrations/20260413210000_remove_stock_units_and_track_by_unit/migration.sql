-- Remove rastreio por peca (StockUnit) e flag trackByUnit em Product.

ALTER TABLE "SaleItem" DROP CONSTRAINT IF EXISTS "SaleItem_stockUnitId_fkey";
ALTER TABLE "CreditSaleItem" DROP CONSTRAINT IF EXISTS "CreditSaleItem_stockUnitId_fkey";

DROP INDEX IF EXISTS "SaleItem_stockUnitId_key";
DROP INDEX IF EXISTS "CreditSaleItem_stockUnitId_key";

ALTER TABLE "SaleItem" DROP COLUMN IF EXISTS "stockUnitId";
ALTER TABLE "CreditSaleItem" DROP COLUMN IF EXISTS "stockUnitId";

DROP TABLE IF EXISTS "StockUnit";

DROP TYPE IF EXISTS "StockUnitStatus";

ALTER TABLE "Product" DROP COLUMN IF EXISTS "trackByUnit";
