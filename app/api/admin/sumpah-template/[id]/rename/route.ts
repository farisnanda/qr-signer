import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"

const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const

/** Ganti label versi 1 template (dipakai admin waktu import file lokal, kalau mau rename ke label lain, mis. "2022"). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const versi = (body?.versi as string || "").trim().replace(/[^a-zA-Z0-9_-]/g, "")
  if (!versi) {
    return Response.json({ error: "Versi tidak valid (cuma huruf/angka/dash/underscore)" }, { status: 400 })
  }

  const template = await prisma.sumpahTemplate.findUnique({ where: { id } })
  if (!template) return Response.json({ error: "Template tidak ditemukan" }, { status: 404 })

  const clash = await prisma.sumpahTemplate.findUnique({
    where: { agama_versi: { agama: template.agama, versi } },
  })
  if (clash && clash.id !== id) {
    return Response.json({ error: `Template ${template.agama} versi "${versi}" sudah ada` }, { status: 409 })
  }

  const updated = await prisma.sumpahTemplate.update({ where: { id }, data: { versi } })
  return Response.json({ template: updated })
}
