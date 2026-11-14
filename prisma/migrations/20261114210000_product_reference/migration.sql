-- AlterTable
ALTER TABLE "Product" ADD COLUMN "reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_creatorId_reference_key" ON "Product"("creatorId", "reference");
