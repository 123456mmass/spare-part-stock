-- AlterTable
ALTER TABLE "Part" ADD COLUMN "barcodeValue" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Part_barcodeValue_key" ON "Part"("barcodeValue");
