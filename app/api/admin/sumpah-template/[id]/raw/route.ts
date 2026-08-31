import { prisma } from "@/lib/prisma"
import { downloadFromMinio, DOCX_CONTENT_TYPE } from "@/lib/minio"
import { verifyDownloadToken } from "@/lib/onlyoffice"

const TEMPLATE_BUCKET = "qr-signer-templates"

/**
 * Proxy download docx buat OnlyOffice — GANTI presigned Minio URL langsung
 * (lihat catatan di lib/onlyoffice.ts signDownloadToken). App yang fetch ke
 * Minio via SDK, OnlyOffice cuma hit endpoint internal ini dengan token pendek.
 * Auth: token HMAC (bukan session cookie) — OnlyOffice ga bisa kirim cookie admin.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  const token = url.searchParams.get("token") || ""

  if (!token || !verifyDownloadToken(token, id)) {
    return new Response("Unauthorized", { status: 401 })
  }

  const template = await prisma.sumpahTemplate.findUnique({ where: { id } })
  if (!template) return new Response("Template tidak ditemukan", { status: 404 })

  const buffer = await downloadFromMinio(TEMPLATE_BUCKET, template.fileKey)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_CONTENT_TYPE,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  })
}
