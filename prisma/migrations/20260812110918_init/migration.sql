-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('SILVER', 'GOLD', 'DIAMOND');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('INTERSTATE', 'INTRASTATE');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('USDOT_REGISTRATION', 'MC_AUTHORITY', 'INSURANCE', 'PROCESS_AGENT', 'UCR_REGISTRATION', 'IFTA_LICENSE', 'IRP_PLATE', 'HVUT_RECEIPT', 'EMISSIONS_CERT', 'CA_MCP', 'MEDICAL_CARD', 'CDL');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED', 'MISSING');

-- CreateEnum
CREATE TYPE "ObligationType" AS ENUM ('MCS150_BIENNIAL_UPDATE', 'IFTA_QUARTERLY_RETURN', 'HVUT_FORM_2290', 'CARB_CLEAN_TRUCK_CHECK', 'IRP_RENEWAL', 'UCR_RENEWAL', 'MEDICAL_CARD_RENEWAL');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('UPCOMING', 'DUE', 'OVERDUE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "dotNumber" TEXT NOT NULL,
    "mcNumber" TEXT,
    "legalName" TEXT NOT NULL,
    "dba" TEXT,
    "ein" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "baseState" TEXT NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "forHire" BOOLEAN NOT NULL DEFAULT true,
    "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "tier" "Tier" NOT NULL DEFAULT 'SILVER',
    "memberSince" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "grossWeightLbs" INTEGER NOT NULL,
    "plateState" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "cdlNumber" TEXT NOT NULL,
    "cdlState" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "truckId" TEXT,
    "driverId" TEXT,
    "type" "CredentialType" NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "identifier" TEXT,
    "issuedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialGate" (
    "id" TEXT NOT NULL,
    "blockerType" "CredentialType" NOT NULL,
    "blockedType" "CredentialType" NOT NULL,
    "reason" TEXT NOT NULL,
    "citation" TEXT NOT NULL,

    CONSTRAINT "CredentialGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obligation" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "truckId" TEXT,
    "driverId" TEXT,
    "type" "ObligationType" NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "earliestStart" TIMESTAMP(3),
    "status" "ObligationStatus" NOT NULL DEFAULT 'UPCOMING',
    "coveredByTier" BOOLEAN NOT NULL DEFAULT true,
    "citation" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Obligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationBlock" (
    "id" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "ObligationBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecomputeRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "carriersProcessed" INTEGER NOT NULL DEFAULT 0,
    "obligationsWritten" INTEGER NOT NULL DEFAULT 0,
    "blocksWritten" INTEGER NOT NULL DEFAULT 0,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecomputeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "credentialId" TEXT,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filing" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "confirmationRef" TEXT NOT NULL,

    CONSTRAINT "Filing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_dotNumber_key" ON "Carrier"("dotNumber");

-- CreateIndex
CREATE INDEX "Carrier_state_idx" ON "Carrier"("state");

-- CreateIndex
CREATE INDEX "Carrier_tier_idx" ON "Carrier"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_vin_key" ON "Truck"("vin");

-- CreateIndex
CREATE INDEX "Truck_carrierId_idx" ON "Truck"("carrierId");

-- CreateIndex
CREATE INDEX "Driver_carrierId_idx" ON "Driver"("carrierId");

-- CreateIndex
CREATE INDEX "Credential_carrierId_idx" ON "Credential"("carrierId");

-- CreateIndex
CREATE INDEX "Credential_truckId_idx" ON "Credential"("truckId");

-- CreateIndex
CREATE INDEX "Credential_expiresOn_idx" ON "Credential"("expiresOn");

-- CreateIndex
CREATE INDEX "Credential_type_status_idx" ON "Credential"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialGate_blockerType_blockedType_key" ON "CredentialGate"("blockerType", "blockedType");

-- CreateIndex
CREATE INDEX "Obligation_dueOn_status_idx" ON "Obligation"("dueOn", "status");

-- CreateIndex
CREATE INDEX "Obligation_carrierId_idx" ON "Obligation"("carrierId");

-- CreateIndex
CREATE INDEX "Obligation_truckId_idx" ON "Obligation"("truckId");

-- CreateIndex
CREATE INDEX "Obligation_status_idx" ON "Obligation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Obligation_ruleId_carrierId_truckId_driverId_periodLabel_key" ON "Obligation"("ruleId", "carrierId", "truckId", "driverId", "periodLabel");

-- CreateIndex
CREATE INDEX "ObligationBlock_blockerId_idx" ON "ObligationBlock"("blockerId");

-- CreateIndex
CREATE UNIQUE INDEX "ObligationBlock_blockedId_blockerId_key" ON "ObligationBlock"("blockedId", "blockerId");

-- CreateIndex
CREATE INDEX "Document_carrierId_idx" ON "Document"("carrierId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Filing_obligationId_idx" ON "Filing"("obligationId");

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationBlock" ADD CONSTRAINT "ObligationBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "Obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationBlock" ADD CONSTRAINT "ObligationBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "Obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Filing" ADD CONSTRAINT "Filing_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
