import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireAdminRole } from "@/lib/security"
import { prisma } from "@/lib/prisma"
import { HtmlTemplateEditor } from "@/components/admin/html-template-editor"

export default async function EditSumpahTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminRole(["SUPERADMIN", "ADMIN"])
  if (!session) redirect("/admin")

  const { id } = await params
  const template = await prisma.sumpahTemplate.findUnique({ where: { id } })
  if (!template) redirect("/admin/settings/sumpah-template")

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/settings/sumpah-template"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke daftar
          </Link>
          <h1 className="text-xl font-bold text-slate-900">
            {template.agama} — {template.versi}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Edit langsung di sini, klik tombol Simpan buat nyimpen. Ga perlu upload file lagi.
          </p>
        </div>
      </div>

      <HtmlTemplateEditor templateId={template.id} />
    </div>
  )
}
