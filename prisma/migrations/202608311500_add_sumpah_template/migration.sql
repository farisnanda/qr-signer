CREATE TABLE IF NOT EXISTS "SumpahTemplate" (
    "id" TEXT NOT NULL,
    "agama" TEXT NOT NULL,
    "versi" TEXT NOT NULL DEFAULT 'standar',
    "fileKey" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SumpahTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SumpahTemplate_agama_versi_key" ON "SumpahTemplate" ("agama", "versi");
