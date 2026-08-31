import { getMaintenanceStatus } from "@/lib/maintenance"
import { MaintenanceCountdown } from "@/components/peserta/maintenance-countdown"

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
