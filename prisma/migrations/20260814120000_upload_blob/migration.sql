-- CreateTable
CREATE TABLE "UploadBlob" (
    "key" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadBlob_pkey" PRIMARY KEY ("key")
);
