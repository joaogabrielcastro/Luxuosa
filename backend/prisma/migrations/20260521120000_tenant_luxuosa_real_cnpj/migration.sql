-- Tenant Luxuosa: CNPJ real cadastrado na Nuvem Fiscal (LUXUOSA PRESENTES LTDA)
-- Substitui o CNPJ ficticio do seed antigo (12345678000199).

UPDATE "Tenant"
SET
  "cnpj" = '12440489000100',
  "name" = 'Luxuosa Presentes',
  "email" = 'transguilucas1@hotmail.com',
  "phone" = '4136562090',
  "enableNfceEmission" = true
WHERE "cnpj" = '12345678000199'
  AND NOT EXISTS (
    SELECT 1 FROM "Tenant" AS t WHERE t."cnpj" = '12440489000100' AND t."id" <> "Tenant"."id"
  );
