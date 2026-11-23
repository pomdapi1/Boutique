-- AlterTable
ALTER TABLE "Product" ADD COLUMN "vatRate" REAL;

-- Produits existants : taux utilisé jusqu'ici dans les exports CSV SumUp (réglage admin, 20 % par défaut)
UPDATE "Product"
SET "vatRate" = COALESCE((SELECT CAST("value" AS REAL) FROM "Setting" WHERE "key" = 'defaultVatRate'), 20);
