-- AlterTable
ALTER TABLE "Carrier" ADD COLUMN     "portalToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_portalToken_key" ON "Carrier"("portalToken");

