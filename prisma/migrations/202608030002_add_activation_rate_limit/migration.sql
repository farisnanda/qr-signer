ALTER TABLE "Peserta" ADD COLUMN IF NOT EXISTS "activationSentAt" TIMESTAMP(3);
ALTER TABLE "Peserta" ADD COLUMN IF NOT EXISTS "activationWindowStart" TIMESTAMP(3);
ALTER TABLE "Peserta" ADD COLUMN IF NOT EXISTS "activationRequestCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Peserta_activationWindowStart_idx" ON "Peserta" ("activationWindowStart");
