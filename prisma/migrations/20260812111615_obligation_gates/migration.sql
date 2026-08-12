/*
  Warnings:

  - You are about to drop the `CredentialGate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "CredentialGate";

-- CreateTable
CREATE TABLE "ObligationGate" (
    "id" TEXT NOT NULL,
    "blockerType" "ObligationType" NOT NULL,
    "blockedType" "ObligationType" NOT NULL,
    "reason" TEXT NOT NULL,
    "citation" TEXT NOT NULL,

    CONSTRAINT "ObligationGate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObligationGate_blockerType_blockedType_key" ON "ObligationGate"("blockerType", "blockedType");
