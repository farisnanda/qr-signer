# Konfigurasi Minio Object Storage

Aplikasi qr-signer menggunakan **Minio** (S3-compatible object storage) untuk menyimpan hasil SK (ZIP, laporan, PDF verifikasi QR) secara langsung, alih-alih filesystem lokal.

## Environment Variables

### Lokal (Development)
Buat file `.env.local` (JANGAN di-commit):
```
MINIO_ACCESS_KEY=bkdjatim
MINIO_SECRET_KEY=bkdjatimadmin!23
```

File `.env` (sudah di-repo):
```
MINIO_ENDPOINT=siasn.bdk.jatimprov.go.id
MINIO_PORT=9000
MINIO_BUCKET=qr-signer-sk
```

### Produksi (Docker Compose)
Di VPS, jalankan container dengan environment variables:

**Opsi 1: Via `-e` flag**
```bash
docker run -e MINIO_ACCESS_KEY=<user> -e MINIO_SECRET_KEY=<pass> ...
```

**Opsi 2: Via `.env` file terpisah** (rekomendasi)
```bash
# File: /home/bkd/qr-signer/.env.minio (mode 600, JANGAN publik)
MINIO_ACCESS_KEY=bkdjatim
MINIO_SECRET_KEY=bkdjatimadmin!23

# Jalankan dengan
docker compose --env-file .env.minio up -d
```

**Opsi 3: Via docker secrets** (Swarm / paling aman)
```bash
echo "bkdjatim" | docker secret create minio_access_key -
echo "bkdjatimadmin!23" | docker secret create minio_secret_key -
```

## Workflow

### Bulk Sign SK
1. User upload Excel, pilih template, masukkan TTE
2. App generate PDF + QR verifikasi dari template
3. **Minio upload**: verifikasi PDF → `verify/{verifyToken}.pdf`
4. **Minio upload**: ZIP batch → `batch/{batchId}/SK_PNS_ddmmyyyy_xxxx.zip`
5. **Minio upload**: laporan Excel → `batch/{batchId}/LAPORAN_SK_PNS_ddmmyyyy_xxxx.xlsx`
6. Database record:
   - Document.filePath = presigned URL Minio (7 hari berlaku)
   - SignBatch.zipFileName = `batch/{batchId}/...zip` (Minio path)
   - SignBatch.reportFileName = `batch/{batchId}/...xlsx` (Minio path)

### Download (QR Verifikasi)
1. User buka halaman `/verify/{token}`
2. Halaman fetch presigned URL dari Document.filePath (sudah publik)
3. PDF dibuka di browser (inline display)

### Download ZIP / Laporan
1. User klik tombol download di riwayat
2. Route `/api/bulk-sk-download/{path}` menerima parameter
3. Deteksi: jika path berisi `/` → Minio object path
4. Generate presigned URL, redirect ke Minio (302)
5. Browser download langsung dari Minio (7 hari)

## Testing Lokal

**Pastikan Minio server dapat diakses:**
```bash
node -e '
const b="siasn.bdk.jatimprov.go.id:9000";
fetch("http://"+b,{headers:{"Authorization":"Basic "+Buffer.from("bkdjatim:bkdjatimadmin!23").toString("base64")}})
.then(r=>console.log("Status:",r.status))
.catch(e=>console.log("Error:",e.cause?.code||e.message))
'
```

Atau gunakan Minio CLI:
```bash
mcli --insecure alias set bkd https://siasn.bdk.jatimprov.go.id:9000 bkdjatim bkdjatimadmin!23
mcli ls bkd/qr-signer-sk
```

## Bucket Policy (Presigned URL / QR Public)

Presigned URL Minio dibuat dengan ttl 7 hari dan otomatis publik (tidak perlu bucket policy). 
QR verifikasi PDF dapat dibuka siapa saja (tanpa login) selama URL masih berlaku.

Jika ingin permanent public bucket (tidak disarankan untuk SK):
```bash
mcli policy set public bkd/qr-signer-sk
```

## Troubleshooting

### "ECONNREFUSED" saat upload
→ Minio server tidak accessible dari container. Periksa:
- Network connectivity VPS → Minio endpoint
- Firewall rules (port 9000 terbuka?)
- IP VPS di-whitelist oleh Minio admin?

### Presigned URL expired
→ User menunggu >7 hari sebelum download. Regenerate presigned URL dengan:
```bash
GET /api/bulk-sk-download/{batchId}/SK_PNS_ddmmyyyy_xxxx.zip
# Server generate presigned URL baru dan redirect (302)
```

### Bucket tidak ada
→ Minio SDK auto-create bucket jika belum ada (hanya pertama kali).
Jika permission denied: periksa MINIO_ACCESS_KEY / MINIO_SECRET_KEY.

## Migrasi dari Filesystem ke Minio

Jika ada SK lama tersimpan di filesystem (`private/uploads/bulk_sk/`):

```bash
# Bash script untuk upload lama ke Minio
for file in private/uploads/bulk_sk/*.zip; do
  mcli cp "$file" "bkd/qr-signer-sk/batch/migration/$(basename $file)"
done
```

Update database:
```sql
UPDATE sign_batch 
SET zip_file_name = CONCAT('batch/migration/', zip_file_name)
WHERE zip_file_name NOT LIKE 'batch/%';
```
