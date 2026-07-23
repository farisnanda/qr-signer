import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { PesertaImportForm } from "@/components/peserta/import-form"
import { PesertaSearch } from "@/components/peserta/peserta-search"

export const dynamic = "force-dynamic"

const PER_PAGE = 25

function statusBadge(p: { email: string | null; emailVerified: boolean }) {
  if (!p.email) return { label: "Belum aktivasi", cls: "bg-slate-100 text-slate-600" }
  if (!p.emailVerified) return { label: "Menunggu verifikasi", cls: "bg-amber-100 text-amber-700" }
  return { label: "Aktif", cls: "bg-green-100 text-green-700" }
}

export default async function PesertaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q || "").trim()

  // Filter pencarian (NIP / nama / perangkat daerah), case-insensitive.
  const where = q
    ? {
        OR: [
          { nip: { contains: q, mode: "insensitive" as const } },
          { nama: { contains: q, mode: "insensitive" as const } },
          { perangkatDaerah: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [total, aktif, pending, belum, matching] = await Promise.all([
    prisma.peserta.count(),
    prisma.peserta.count({ where: { emailVerified: true } }),
    prisma.peserta.count({ where: { email: { not: null }, emailVerified: false } }),
    prisma.peserta.count({ where: { email: null } }),
    prisma.peserta.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(matching / PER_PAGE))
  const page = Math.min(Math.max(1, parseInt(sp.page || "1", 10) || 1), totalPages)

  const peserta = await prisma.peserta.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  })

  const from = matching === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const to = Math.min(page * PER_PAGE, matching)
  const pageHref = (n: number) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (n > 1) params.set("page", String(n))
    const s = params.toString()
    return `/admin/peserta${s ? "?" + s : ""}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Peserta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Import data peserta pengambilan sumpah. Peserta mengaktivasi akun sendiri (email + password) lalu verifikasi via email.
        </p>
      </div>

      <PesertaImportForm />

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: total, cls: "text-slate-900" },
          { label: "Aktif", value: aktif, cls: "text-green-600" },
          { label: "Menunggu verifikasi", value: pending, cls: "text-amber-600" },
          { label: "Belum aktivasi", value: belum, cls: "text-slate-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <PesertaSearch defaultValue={q} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">NIP</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Pangkat</th>
              <th className="px-4 py-3 font-medium">Perangkat Daerah</th>
              <th className="px-4 py-3 font-medium">Agama</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {peserta.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {q ? `Tidak ada peserta cocok dengan "${q}".` : "Belum ada peserta. Import Excel untuk mulai."}
                </td>
              </tr>
            ) : (
              peserta.map((p) => {
                const b = statusBadge(p)
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.nip}</td>
                    <td className="px-4 py-3 text-slate-900">{p.nama}</td>
                    <td className="px-4 py-3 text-slate-600">{p.pangkat}</td>
                    <td className="px-4 py-3 text-slate-600">{p.perangkatDaerah}</td>
                    <td className="px-4 py-3 text-slate-600">{p.agama}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-slate-500">
          Menampilkan {from}–{to} dari {matching}
          {q ? " hasil pencarian" : " peserta"}
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50">
              ← Sebelumnya
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-3 py-1.5 font-medium text-slate-300">← Sebelumnya</span>
          )}
          <span className="text-slate-500">Halaman {page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50">
              Berikutnya →
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-3 py-1.5 font-medium text-slate-300">Berikutnya →</span>
          )}
        </div>
      </div>
    </div>
  )
}
