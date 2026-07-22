import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function SesiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesi = await prisma.sesi.findUnique({
    where: { id },
    include: { kehadiran: { orderBy: { checkedInAt: "asc" } } },
  })
  if (!sesi) notFound()

  const nips = sesi.kehadiran.map((k) => k.pesertaNip)
  const peserta = await prisma.peserta.findMany({ where: { nip: { in: nips } } })
  const byNip = new Map(peserta.map((p) => [p.nip, p]))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/sesi" className="text-sm text-blue-600 hover:underline">← Kembali ke daftar sesi</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{sesi.nama}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
          <span>
            PIN: <span className="font-mono font-bold tracking-widest text-slate-800">{sesi.pin}</span>
          </span>
          <span>·</span>
          <span>{sesi.aktif ? "Aktif" : "Nonaktif"}</span>
          <span>·</span>
          <span>{sesi.kehadiran.length} hadir</span>
        </div>
      </div>

      <div className="flex gap-2">
        <a
          href={`/qr-signer/api/sesi/${sesi.id}/export`}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          Export Kehadiran (Excel)
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">No</th>
              <th className="px-4 py-3 font-medium">NIP</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Pangkat</th>
              <th className="px-4 py-3 font-medium">Perangkat Daerah</th>
              <th className="px-4 py-3 font-medium">Waktu Absen</th>
              <th className="px-4 py-3 font-medium">Dokumen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sesi.kehadiran.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Belum ada peserta yang absen di sesi ini.</td>
              </tr>
            ) : (
              sesi.kehadiran.map((k, i) => {
                const p = byNip.get(k.pesertaNip)
                return (
                  <tr key={k.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{k.pesertaNip}</td>
                    <td className="px-4 py-3 text-slate-900">{k.pesertaNama}</td>
                    <td className="px-4 py-3 text-slate-600">{p?.pangkat ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{p?.perangkatDaerah ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{k.checkedInAt.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3">
                      {k.dokumenKey ? (
                        <a
                          href={`/qr-signer/api/admin/berita-acara?nip=${k.pesertaNip}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                        >
                          Lihat BA
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Belum ada</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
