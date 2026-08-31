import { prisma } from "@/lib/prisma"
import { uploadToMinio, DOCX_CONTENT_TYPE } from "@/lib/minio"
import { verifyOnlyOfficeJwt, newDocumentKey } from "@/lib/onlyoffice"

const TEMPLATE_BUCKET = "qr-signer-templates"

// status OnlyOffice: 2 = MustSave, 6 = MustForceSave -> ada file baru diunduh.
// Selain itu (editing/closed-no-change/error) cuma di-ack, ga ada aksi.
const SAVE_STATUSES = new Set([2, 6])

/**
 * Dipanggil OLEH OnlyOffice Document Server (server-to-server), bukan browser
 * admin — makanya autentikasi pakai JWT bersama (ONLYOFFICE_JWT_SECRET), bukan
 * session next-auth. Response WAJIB { error: 0 } kalau sukses, format ini yang
 * dicek OnlyOffice buat nentuin retry atau tidak.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 1 })

  // Token bisa di header Authorization: Bearer <jwt>, atau field body.token
  // (payload = seluruh body) — tergantung versi Document Server. Cek dua-duanya.
  const authHeader = request.headers.get("authorization") || ""
  const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const token = headerToken || body.token

  if (!token || !verifyOnlyOfficeJwt(token)) {
    console.error("[SumpahTemplate callback] JWT tidak valid, ditolak")
    return Response.json({ error: 1 })
  }

  if (!SAVE_STATUSES.has(body.status)) {
    // status lain (1 editing, 4 closed-no-change, dst) — cukup di-ack.
    return Response.json({ error: 0 })
  }

  try {
    const template = await prisma.sumpahTemplate.findUnique({ where: { id } })
    if (!template) return Response.json({ error: 1 })

    const fileRes = await fetch(body.url)
    if (!fileRes.ok) throw new Error(`Gagal unduh file dari OnlyOffice: HTTP ${fileRes.status}`)
    const buffer = Buffer.from(await fileRes.arrayBuffer())

    const documentKey = newDocumentKey()
    const fileKey = `sumpah/${template.agama}/${template.versi}/${documentKey}.docx`
    await uploadToMinio(TEMPLATE_BUCKET, fileKey, buffer, DOCX_CONTENT_TYPE)

    await prisma.sumpahTemplate.update({
      where: { id },
      data: {
        fileKey,
        documentKey,
        updatedBy: Array.isArray(body.users) ? body.users[0] : undefined,
      },
    })

    return Response.json({ error: 0 })
  } catch (err) {
    console.error("[SumpahTemplate callback] Gagal simpan:", err instanceof Error ? err.message : err)
    return Response.json({ error: 1 })
  }
}
