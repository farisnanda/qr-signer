ALTER TABLE "SignBatch" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'done';

CREATE INDEX "SignBatch_status_createdAt_idx" ON "SignBatch"("status", "createdAt");
