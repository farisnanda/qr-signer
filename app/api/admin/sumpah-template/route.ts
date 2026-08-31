import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"
import { uploadToMinio, downloadFromMinio, DOCX_CONTENT_TYPE } from "@/lib/minio"
import { newDocumentKey } from "@/lib/onlyoffice"

const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const
const AGAMA_LIST = ["Islam", "Kristen", "Budha", "Hindu", "Katolik"] as const
const TEMPLATE_BUCKET = "qr-signer-templates"

function templateKey(agama: string, versi: string, documentKey: string): string {
  return `sumpah/${agama}/${versi}/${documentKey}.docx`
}

/** Daftar semua template (grid agama x versi), buat halaman admin. */
export async function GET() {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const list = await prisma.sumpahTemplate.findMany({ orderBy: [{ agama: "asc" }, { versi: "asc" }] })
  return Response.json({ list, agamaOptions: AGAMA_LIST })
}

/**
 * Buat baris template baru. Dua mode:
 * - Upload file .docx awal (form field "file") — sekali ini aja, edit
 *   selanjutnya lewat OnlyOffice.
 * - Clone dari template lain yang sudah ada (form field "cloneFromId") —
 *   ga perlu upload sama sekali.
 */
export async function POST(request: Request) {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const agama = (formData.get("agama") as string || "").trim()
  const versi = (formData.get("versi") as string || "").trim() || "standar"
  const cloneFromId = formData.get("cloneFromId") as string | null
  const file = formData.get("file") as File | null

  if (!AGAMA_LIST.includes(agama as any)) {
    return Response.json({ error: "Agama tidak valid" }, { status: 400 })
  }
  // Sanitasi versi sama kayak lib/sumpah.ts — bagian ini yang dipakai jadi
  // path folder Minio & yang admin ketik bebas.
  const safeVersi = versi.replace(/[^a-zA-Z0-9_-]/g, "")
  if (!safeVersi) {
    return Response.json({ error: "Versi tidak valid (cuma huruf/angka/dash/underscore)" }, { status: 400 })
  }

  const existing = await prisma.sumpahTemplate.findUnique({ where: { agama_versi: { agama, versi: safeVersi } } })
  if (existing) {
    return Response.json({ error: `Template ${agama} versi "${safeVersi}" sudah ada` }, { status: 409 })
  }

  let buffer: Buffer
  if (cloneFromId) {
    const source = await prisma.sumpahTemplate.findUnique({ where: { id: cloneFromId } })
    if (!source) return Response.json({ error: "Template sumber clone tidak ditemukan" }, { status: 404 })
    buffer = await downloadFromMinio(TEMPLATE_BUCKET, source.fileKey)
  } else if (file) {
    buffer = Buffer.from(await file.arrayBuffer())
  } else {
    return Response.json({ error: "Wajib upload file atau pilih template buat di-clone" }, { status: 400 })
  }

  const documentKey = newDocumentKey()
  const fileKey = templateKey(agama, safeVersi, documentKey)
  await uploadToMinio(TEMPLATE_BUCKET, fileKey, buffer, DOCX_CONTENT_TYPE)

  const created = await prisma.sumpahTemplate.create({
    data: { agama, versi: safeVersi, fileKey, documentKey, updatedBy: session.user.email },
  })

  return Response.json({ template: created })
}
