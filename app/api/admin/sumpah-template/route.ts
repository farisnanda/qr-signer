import { readFileSync } from "fs"
import { join } from "path"
import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"
import { uploadToMinio, downloadFromMinio, DOCX_CONTENT_TYPE } from "@/lib/minio"
import { newDocumentKey } from "@/lib/onlyoffice"
import { discoverLocalTemplates, findLocalTemplate } from "@/lib/sumpah-template-discovery"

const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const
const AGAMA_LIST = ["Islam", "Kristen", "Budha", "Hindu", "Katolik"] as const
const TEMPLATE_BUCKET = "qr-signer-templates"

function templateKey(agama: string, versi: string, documentKey: string): string {
  return `sumpah/${agama}/${versi}/${documentKey}.docx`
}

/**
 * Daftar semua template buat halaman admin — gabungan baris yang udah di
 * sistem (DB+Minio+OnlyOffice) DAN file .docx lokal di templates/CEK/ yang
 * masih peninggalan lama, belum di-import. Baris lokal ditandai
 * source:"local", klik "Edit" di situ langsung import + buka editor sekaligus
 * (lihat POST mode "importLocal" di bawah) — ga perlu upload manual.
 */
export async function GET() {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const dbList = await prisma.sumpahTemplate.findMany({ orderBy: [{ agama: "asc" }, { versi: "asc" }] })
  const dbKeys = new Set(dbList.map((t) => `${t.agama}::${t.versi}`))

  const localOnly = discoverLocalTemplates()
    .filter((t) => !dbKeys.has(`${t.agama}::${t.versi}`))
    .map((t) => ({
      id: null,
      agama: t.agama,
      versi: t.versi,
      updatedAt: null,
      updatedBy: null,
      source: "local" as const,
    }))

  const list = [
    ...dbList.map((t) => ({ ...t, source: "db" as const })),
    ...localOnly,
  ].sort((a, b) => a.agama.localeCompare(b.agama) || a.versi.localeCompare(b.versi))

  return Response.json({ list, agamaOptions: AGAMA_LIST })
}

/**
 * Buat baris template baru. Tiga mode:
 * - Import dari file lokal server (form field "importLocal"="1") — buat baris
 *   yang muncul di GET dengan source:"local", server yang baca filenya
 *   sendiri (path ga pernah dipercaya dari client, di-resolve ulang lewat
 *   findLocalTemplate berdasar agama+versi).
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
  const importLocal = formData.get("importLocal") === "1"

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
  if (importLocal) {
    const localFile = findLocalTemplate(agama, safeVersi)
    if (!localFile) {
      return Response.json({ error: `File lokal untuk ${agama} versi "${safeVersi}" tidak ketemu lagi (mungkin sudah dipindah/dihapus)` }, { status: 404 })
    }
    buffer = readFileSync(join(process.cwd(), "templates/CEK", localFile.localPath))
  } else if (cloneFromId) {
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
