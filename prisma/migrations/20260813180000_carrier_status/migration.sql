-- CreateEnum
CREATE TYPE "CarrierStatus" AS ENUM ('PROSPECT', 'ACTIVE');

-- AlterTable
ALTER TABLE "Carrier" ADD COLUMN     "status" "CarrierStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "onboardingProfile" JSONB,
ADD COLUMN     "recommendedPackage" TEXT,
ADD COLUMN     "recommendedPrice" INTEGER,
ADD COLUMN     "recommendedTier" "Tier";
