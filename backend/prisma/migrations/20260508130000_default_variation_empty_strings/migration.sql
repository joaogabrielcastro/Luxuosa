-- Normaliza a "variacao padrao" (estoque do produto sem tamanho/cor) para usar strings vazias
-- em vez das strings magicas legadas AUTO/ESTOQUE. O constraint
-- @@unique([tenantId, productId, size, color]) ja garante uma unica linha padrao por produto.
UPDATE "ProductVariation"
SET "size" = '', "color" = ''
WHERE "size" = 'AUTO' AND "color" = 'ESTOQUE';
