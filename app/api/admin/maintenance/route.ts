import { requireAdminRole } from "@/lib/security"
import { getMaintenanceStatus, setMaintenanceStatus } from "@/lib/maintenance"

// Toggle mode maintenance portal peserta — hanya SUPERADMIN/ADMIN.
const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const

export async function GET() {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const status = await getMaintenanceStatus()
  return Response.json(status)
}

export async function POST(request: Request) {
  const session = await requireAdminRole(ALLOWED_ROLES)
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.active !== "boolean") {
    return Response.json({ error: "Payload tidak valid" }, { status: 400 })
  }

  let activeAgainAt: Date | null = null
  if (body.activeAgainAt) {
    const d = new Date(body.activeAgainAt)
    if (Number.isNaN(d.getTime())) {
      return Response.json({ error: "Format tanggal/jam tidak valid" }, { status: 400 })
    }
    activeAgainAt = d
  }

  // Aktifkan maintenance wajib punya target waktu — biar peserta selalu
  // lihat countdown, bukan pesan kosong "nanti".
  if (body.active && !activeAgainAt) {
    return Response.json({ error: "Waktu aktif kembali wajib diisi saat mengaktifkan maintenance" }, { status: 400 })
  }

  const message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : null

  const updated = await setMaintenanceStatus({
    active: body.active,
    message,
    activeAgainAt,
    updatedBy: session.user.email,
  })

  return Response.json({
    active: updated.active,
    message: updated.message,
    activeAgainAt: updated.activeAgainAt,
  })
}
