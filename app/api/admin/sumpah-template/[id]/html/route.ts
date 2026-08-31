import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"
import { downloadFromMinio } from "@/lib/minio"
import mammoth from "mammoth"

const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const
const TEMPLATE_BUCKET = "qr-signer-templates"

/**
 * Konversi docx template -> HTML buat ditampilkan di editor rich-text browser.
 * GANTI OnlyOffice (deploy-nya kelewat ribet di VPS ini — build cache stale,
 * signature MinIO mismatch di axios). Ini jalan langsung di app sendiri,
 * ga butuh container/service tambahan.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const template = await prisma.sumpahTemplate.findUnique({ where: { id } })
  if (!template) return Response.json({ error: "Template tidak ditemukan" }, { status: 404 })

  const buffer = await downloadFromMinio(TEMPLATE_BUCKET, template.fileKey)
  const result = await mammoth.convertToHtml({ buffer })

  return Response.json({
    html: result.value,
    warnings: result.messages.map((m) => m.message),
    template: { id: template.id, agama: template.agama, versi: template.versi, updatedAt: template.updatedAt, updatedBy: template.updatedBy },
  })
}
