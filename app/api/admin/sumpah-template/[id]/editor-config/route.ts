import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"
import { signOnlyOfficeJwt, signDownloadToken } from "@/lib/onlyoffice"

const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const

// URL internal container-ke-container (network-sharing) buat OnlyOffice
// manggil balik server ini — bukan URL publik, ga lewat reverse proxy host.
// Nama service Docker "qr-signer" (container_name di docker-compose.yml),
// port 3000 = port INTERNAL container (bukan 3002 yg di-mapping ke host).
const INTERNAL_APP_URL = process.env.ONLYOFFICE_CALLBACK_APP_URL || "http://qr-signer:3000/qr-signer"

/** Config buat DocsAPI.DocEditor() di halaman edit template. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const template = await prisma.sumpahTemplate.findUnique({ where: { id } })
  if (!template) return Response.json({ error: "Template tidak ditemukan" }, { status: 404 })

  // documentUrl dipakai OnlyOffice buat NARIK file sumber — proxy lewat app
  // sendiri (bukan presigned Minio langsung, lihat catatan di lib/onlyoffice.ts).
  const downloadToken = signDownloadToken(template.id, 600)
  const documentUrl = `${INTERNAL_APP_URL}/api/admin/sumpah-template/${template.id}/raw?token=${downloadToken}`
  const callbackUrl = `${INTERNAL_APP_URL}/api/admin/sumpah-template/${template.id}/callback`

  const config: Record<string, any> = {
    document: {
      fileType: "docx",
      key: template.documentKey,
      title: `${template.agama}-${template.versi}.docx`,
      url: documentUrl,
      permissions: { edit: true, download: true, print: true },
    },
    documentType: "word",
    editorConfig: {
      callbackUrl,
      lang: "id",
      user: { id: session.user.email, name: session.user.name || session.user.email },
    },
  }
  config.token = signOnlyOfficeJwt(config)

  return Response.json({
    config,
    publicUrl: process.env.ONLYOFFICE_PUBLIC_URL || "",
    template: { id: template.id, agama: template.agama, versi: template.versi, updatedAt: template.updatedAt, updatedBy: template.updatedBy },
  })
}
