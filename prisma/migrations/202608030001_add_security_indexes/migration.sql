CREATE INDEX IF NOT EXISTS "Peserta_emailVerified_createdAt_idx" ON "Peserta" ("emailVerified", "createdAt");
CREATE INDEX IF NOT EXISTS "Peserta_perangkatDaerah_idx" ON "Peserta" ("perangkatDaerah");
CREATE INDEX IF NOT EXISTS "Peserta_createdAt_idx" ON "Peserta" ("createdAt");

CREATE INDEX IF NOT EXISTS "KoreksiData_status_createdAt_idx" ON "KoreksiData" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "KoreksiData_pesertaNip_createdAt_idx" ON "KoreksiData" ("pesertaNip", "createdAt");

CREATE INDEX IF NOT EXISTS "Sesi_aktif_createdAt_idx" ON "Sesi" ("aktif", "createdAt");
CREATE INDEX IF NOT EXISTS "Sesi_pin_aktif_idx" ON "Sesi" ("pin", "aktif");
ALTER TABLE "Sesi" ADD COLUMN IF NOT EXISTS "pinHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Sesi_pinHash_key" ON "Sesi" ("pinHash");
CREATE INDEX IF NOT EXISTS "Sesi_pinHash_aktif_idx" ON "Sesi" ("pinHash", "aktif");

CREATE INDEX IF NOT EXISTS "Kehadiran_pesertaNip_idx" ON "Kehadiran" ("pesertaNip");
CREATE INDEX IF NOT EXISTS "Kehadiran_checkedInAt_idx" ON "Kehadiran" ("checkedInAt");

CREATE INDEX IF NOT EXISTS "SignBatch_signedBy_createdAt_idx" ON "SignBatch" ("signedBy", "createdAt");
CREATE INDEX IF NOT EXISTS "SignBatch_jenisSk_createdAt_idx" ON "SignBatch" ("jenisSk", "createdAt");

CREATE INDEX IF NOT EXISTS "SignLog_batchId_signedAt_idx" ON "SignLog" ("batchId", "signedAt");
CREATE INDEX IF NOT EXISTS "SignLog_signedBy_signedAt_idx" ON "SignLog" ("signedBy", "signedAt");
CREATE INDEX IF NOT EXISTS "SignLog_status_signedAt_idx" ON "SignLog" ("status", "signedAt");
CREATE INDEX IF NOT EXISTS "SignLog_nip_idx" ON "SignLog" ("nip");
