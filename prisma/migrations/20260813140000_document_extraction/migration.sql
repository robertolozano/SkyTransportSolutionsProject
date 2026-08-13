-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('NOT_ATTEMPTED', 'UNAVAILABLE', 'PENDING', 'EXTRACTED', 'FAILED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "confidence" TEXT,
ADD COLUMN     "detectedType" TEXT,
ADD COLUMN     "extractedAt" TIMESTAMP(3),
ADD COLUMN     "extractedFields" JSONB,
ADD COLUMN     "extractionNote" TEXT,
ADD COLUMN     "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "sizeBytes" INTEGER;

