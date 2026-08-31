import { redirect } from "next/navigation"
import { requireAdminRole } from "@/lib/security"
import { SumpahTemplateList } from "@/components/admin/sumpah-template-list"

export default async function SumpahTemplatePage() {
  const session = await requireAdminRole(["SUPERADMIN", "ADMIN"])
  if (!session) redirect("/admin")

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Template BA Sumpah</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kelola template Word BA Sumpah per agama & versi. Edit langsung di sini — ga perlu upload ulang tiap ada perbaikan.
        </p>
      </div>
      <SumpahTemplateList />
    </div>
  )
}
