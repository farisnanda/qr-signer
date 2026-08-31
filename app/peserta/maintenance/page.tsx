import { getMaintenanceStatus } from "@/lib/maintenance"
import { MaintenanceCountdown } from "@/components/peserta/maintenance-countdown"

// Wajib dynamic — halaman ini query DB (Prisma) tanpa pakai session/cookies,
// jadi Next.js kira bisa di-prerender static pas build. Tahap build image
// tidak punya DATABASE_URL (env itu cuma ada di runtime lewat docker-compose),
// jadi prerender bakal gagal kalau dibiarkan static.
export const dynamic = "force-dynamic"

// Halaman publik — dituju middleware saat mode maintenance aktif. Kalau
// diakses langsung padahal maintenance sudah nonaktif, langsung lempar
// balik ke login (tidak ada alasan nampilin halaman ini).
export default async function PesertaMaintenancePage() {
  const status = await getMaintenanceStatus()

  if (!status.active) {
    const { redirect } = await import("next/navigation")
    redirect("/peserta/login")
  }

  return (
    <MaintenanceCountdown
      initialMessage={status.message}
      initialActiveAgainAt={status.activeAgainAt ? status.activeAgainAt.toISOString() : null}
    />
  )
}
