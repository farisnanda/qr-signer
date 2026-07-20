import { Client } from "minio"

let minioClient: Client | null = null

/**
 * Singleton Minio client. Inisialisasi sekali, reuse untuk semua operasi upload/download.
 * Akses key & secret diambil dari env (tidak pernah di-log).
 */
export function getMinioClient(): Client {
  if (minioClient) return minioClient

  const endpoint = process.env.MINIO_ENDPOINT || ""
  const port = parseInt(process.env.MINIO_PORT || "9000")
  const accessKey = process.env.MINIO_ACCESS_KEY || ""
  const secretKey = process.env.MINIO_SECRET_KEY || ""

  if (!endpoint || !accessKey || !secretKey) {
    throw new Error("Konfigurasi Minio tidak lengkap (MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY)")
  }

  minioClient = new Client({
    endPoint: endpoint,
    port,
    useSSL: true, // HTTPS ke Minio
    accessKey,
    secretKey,
  })

  return minioClient
}

/**
 * Upload buffer (PDF) ke Minio bucket dengan object name tertentu.
 * @param bucket Nama bucket (mis. "qr-signer-sk")
 * @param objectName Nama file di bucket (mis. "SK_PNS_15072026/SK_001.pdf")
 * @param data Buffer content
 * @returns Nama object yang disimpan
 */
export async function uploadToMinio(
  bucket: string,
  objectName: string,
  data: Buffer | Uint8Array
): Promise<string> {
  try {
    const client = getMinioClient()

    // Pastikan bucket ada, jika tidak buat
    const exists = await client.bucketExists(bucket)
    if (!exists) {
      await client.makeBucket(bucket, "")
      console.log(`[Minio] Bucket "${bucket}" dibuat`)
    }

    // Convert Uint8Array ke Buffer jika perlu
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

    // Upload dengan metadata (biar tracking lebih mudah)
    await client.putObject(bucket, objectName, buffer, buffer.length, {
      "Content-Type": "application/pdf",
    })

    console.log(`[Minio] Upload sukses: ${bucket}/${objectName}`)
    return objectName
  } catch (err: any) {
    console.error(`[Minio] Upload gagal: ${err?.message}`)
    throw new Error(`Gagal upload ke Minio: ${err?.message}`)
  }
}

/**
 * Generate presigned URL untuk download (publik, tanpa akses key).
 * URL berlaku selama `expires` detik (default 7 hari).
 * @param bucket Nama bucket
 * @param objectName Nama file di bucket
 * @param expires Berlaku dalam ... detik (default 7*24*3600 = 1 minggu)
 * @returns URL download publik
 */
export async function getPresignedUrl(
  bucket: string,
  objectName: string,
  expires: number = 7 * 24 * 3600
): Promise<string> {
  try {
    const client = getMinioClient()
    const url = await client.presignedGetObject(bucket, objectName, expires)
    return url
  } catch (err: any) {
    console.error(`[Minio] Presigned URL gagal: ${err?.message}`)
    throw new Error(`Gagal generate presigned URL: ${err?.message}`)
  }
}

/**
 * Download object dari Minio sebagai buffer.
 * @param bucket Nama bucket
 * @param objectName Nama file
 * @returns Buffer content
 */
export async function downloadFromMinio(bucket: string, objectName: string): Promise<Buffer> {
  try {
    const client = getMinioClient()
    const dataStream = await client.getObject(bucket, objectName)

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      dataStream.on("data", (chunk) => chunks.push(chunk))
      dataStream.on("end", () => resolve(Buffer.concat(chunks)))
      dataStream.on("error", (err) => reject(new Error(`Download gagal: ${err?.message}`)))
    })
  } catch (err: any) {
    console.error(`[Minio] Download gagal: ${err?.message}`)
    throw new Error(`Gagal download dari Minio: ${err?.message}`)
  }
}
