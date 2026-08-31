import { redirect } from "next/navigation"
import { requireAdminRole } from "@/lib/security"
import { getMaintenanceStatus } from "@/lib/maintenance"
import { MaintenanceForm } from "@/components/admin/maintenance-form"

export default async function AdminMaintenancePage() {
  const session = await requireAdminRole(["SUPERADMIN", "ADMIN"])
  if (!session) redirect("/admin")

  const status = await getMaintenanceStatus()

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Maintenance</h1>
        <p className="mt-1 text-sm text-slate-600">Kelola mode perbaikan untuk portal peserta.</p>
      </div>
      <MaintenanceForm
        initialActive={status.active}
        initialMessage={status.message}
        initialActiveAgainAt={status.activeAgainAt ? status.activeAgainAt.toISOString() : null}
      />
    </div>
  )
}
