import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"
import { signOnlyOfficeJwt } from "@/lib/onlyoffice"
import { downloadFromMinio } from "@/lib/minio"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const
const TEMPLATE_BUCKET = "qr-signer-templates"

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

  // documentUrl dipakai OnlyOffice buat NARIK file sumber — file statis di
  // public/onlyoffice-tmp/, BUKAN presigned Minio & BUKAN dynamic API route.
  // Next.js serve public/ langsung tanpa lewat compile route (menghindari
  // seluruh kelas bug: signature SigV4 Minio yang mismatch di axios/OnlyOffice,
  // DAN stale build-cache di dynamic route yang bikin deploy gak konsisten).
  // App yang download dari Minio (server-to-server, SDK biasa) lalu simpan
  // ke file sementara ini — OnlyOffice tinggal HTTP GET file statis biasa.
  const buffer = await downloadFromMinio(TEMPLATE_BUCKET, template.fileKey)
  const tmpDir = path.join(process.cwd(), "public", "onlyoffice-tmp")
  await mkdir(tmpDir, { recursive: true })
  const fileName = `${template.documentKey}.docx`
  await writeFile(path.join(tmpDir, fileName), buffer)

  const documentUrl = `${INTERNAL_APP_URL}/onlyoffice-tmp/${fileName}`
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
