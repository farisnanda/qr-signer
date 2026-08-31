import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"
import { uploadToMinio, DOCX_CONTENT_TYPE } from "@/lib/minio"
import { newDocumentKey } from "@/lib/onlyoffice"
// @ts-expect-error - html-to-docx ga punya types resmi
import HTMLtoDOCX from "html-to-docx"

const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const
const TEMPLATE_BUCKET = "qr-signer-templates"

/** Simpan HTML hasil edit -> konversi balik ke docx -> overwrite di Minio. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const template = await prisma.sumpahTemplate.findUnique({ where: { id } })
  if (!template) return Response.json({ error: "Template tidak ditemukan" }, { status: 404 })

  const body = await request.json().catch(() => null)
  const html = body?.html
  if (typeof html !== "string" || !html.trim()) {
    return Response.json({ error: "HTML kosong / tidak valid" }, { status: 400 })
  }

  const docxBuffer = (await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  }))

  await uploadToMinio(TEMPLATE_BUCKET, template.fileKey, docxBuffer, DOCX_CONTENT_TYPE)

  const updated = await prisma.sumpahTemplate.update({
    where: { id },
    data: { documentKey: newDocumentKey(), updatedBy: session.user.email },
  })

  return Response.json({
    ok: true,
    template: { id: updated.id, agama: updated.agama, versi: updated.versi, updatedAt: updated.updatedAt, updatedBy: updated.updatedBy },
  })
}
