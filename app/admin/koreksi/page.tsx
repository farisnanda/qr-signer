import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { KeputusanButtons } from "@/components/koreksi/keputusan-buttons"

export const dynamic = "force-dynamic"

const FIELD_LABEL: Record<string, string> = {
  nama: "Nama",
  agama: "Agama",
  pangkat: "Pangkat",
  perangkatDaerah: "Perangkat Daerah",
}

const TABS = [
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
]

export default async function AdminKoreksiPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const status = TABS.some((t) => t.value === sp.status) ? sp.status! : "pending"

  const [pendingCount, list] = await Promise.all([
    prisma.koreksiData.count({ where: { status: "pending" } }),
    prisma.koreksiData.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: { peserta: { select: { nama: true, email: true, perangkatDaerah: true } } },
      take: 200,
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Koreksi Data Peserta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Permintaan perbaikan data (nama/gelar, agama, pangkat, perangkat daerah) yang diajukan peserta.
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/koreksi?status=${t.value}`}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              status === t.value ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.value === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{pendingCount}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Peserta</th>
              <th className="px-4 py-3 font-medium">Jenis</th>
              <th className="px-4 py-3 font-medium">Perubahan</th>
              <th className="px-4 py-3 font-medium">Alasan</th>
              <th className="px-4 py-3 font-medium">Diajukan</th>
              {status === "pending" && <th className="px-4 py-3 font-medium">Aksi</th>}
              {status !== "pending" && <th className="px-4 py-3 font-medium">Catatan</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Tidak ada permintaan {TABS.find((t) => t.value === status)?.label.toLowerCase()}.
                </td>
              </tr>
            ) : (
              list.map((r) => (
                <tr key={r.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.peserta.nama}</p>
                    <p className="text-xs text-slate-500">{r.pesertaNip}</p>
                    <p className="text-xs text-slate-400">{r.peserta.perangkatDaerah}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{FIELD_LABEL[r.field] || r.field}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-400 line-through">{r.nilaiLama}</p>
                    <p className="font-medium text-slate-800">{r.nilaiDiminta}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[220px] text-xs text-slate-600">{r.alasan || "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    {r.createdAt.toLocaleString("id-ID")}
                  </td>
                  {status === "pending" ? (
                    <td className="px-4 py-3 min-w-[180px]">
                      <KeputusanButtons id={r.id} />
                    </td>
                  ) : (
                    <td className="px-4 py-3 max-w-[200px] text-xs text-slate-600">
                      {r.catatanAdmin || "-"}
                      <p className="mt-1 text-[11px] text-slate-400">
                        oleh {r.diprosesOleh} · {r.diprosesAt?.toLocaleString("id-ID")}
                      </p>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
