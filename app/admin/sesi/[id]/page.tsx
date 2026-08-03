import { prisma } from "@/lib/prisma"
import { decryptSecretValue } from "@/lib/db-security"
import { notFound } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"

const PER_PAGE = 25

export default async function SesiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const q = (sp.q || "").trim()

  const sesi = await prisma.sesi.findUnique({ where: { id } })
  if (!sesi) notFound()

  let matchingNips: string[] = []
  if (q) {
    const matchingPeserta = await prisma.peserta.findMany({
      where: {
        OR: [
          { nip: { contains: q, mode: "insensitive" } },
          { nama: { contains: q, mode: "insensitive" } },
          { pangkat: { contains: q, mode: "insensitive" } },
          { perangkatDaerah: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { nip: true },
      take: 500,
    })
    matchingNips = matchingPeserta.map((p) => p.nip)
  }

  const kehadiranWhere = {
    sesiId: sesi.id,
    ...(q
      ? {
          OR: [
            { pesertaNip: { contains: q, mode: "insensitive" as const } },
            { pesertaNama: { contains: q, mode: "insensitive" as const } },
            ...(matchingNips.length > 0 ? [{ pesertaNip: { in: matchingNips } }] : []),
          ],
        }
      : {}),
  }

  const matching = await prisma.kehadiran.count({ where: kehadiranWhere })
  const totalPages = Math.max(1, Math.ceil(matching / PER_PAGE))
  const page = Math.min(Math.max(1, parseInt(sp.page || "1", 10) || 1), totalPages)

  const kehadiran = await prisma.kehadiran.findMany({
    where: kehadiranWhere,
    orderBy: { checkedInAt: "asc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  })

  const nips = kehadiran.map((k) => k.pesertaNip)
  const peserta = await prisma.peserta.findMany({
    where: { nip: { in: nips } },
    select: { nip: true, pangkat: true, perangkatDaerah: true },
  })
  const byNip = new Map(peserta.map((p) => [p.nip, p]))
  const from = matching === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const to = Math.min(page * PER_PAGE, matching)

  const pageHref = (n: number) => {
    const query = new URLSearchParams()
    if (q) query.set("q", q)
    if (n > 1) query.set("page", String(n))
    const s = query.toString()
    return `/admin/sesi/${sesi.id}${s ? "?" + s : ""}`
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/sesi" className="text-sm text-blue-600 hover:underline">
          Kembali ke daftar sesi
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{sesi.nama}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>
            PIN:{" "}
            <span className="font-mono font-bold tracking-widest text-slate-800">
              {decryptSecretValue(sesi.pin)}
            </span>
          </span>
          <span>|</span>
          <span>{sesi.aktif ? "Aktif" : "Nonaktif"}</span>
          <span>|</span>
          <span>{matching} hadir</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <form className="flex flex-1 gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari NIP, nama, pangkat, atau perangkat daerah"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-950 placeholder:text-slate-500"
          />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Cari
          </button>
          {q && (
            <Link href={`/admin/sesi/${sesi.id}`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
              Reset
            </Link>
          )}
        </form>
        <a
          href={`/qr-signer/api/sesi/${sesi.id}/export`}
          className="rounded-xl bg-green-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-green-700"
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
            {kehadiran.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {q ? `Tidak ada kehadiran cocok dengan "${q}".` : "Belum ada peserta yang absen di sesi ini."}
                </td>
              </tr>
            ) : (
              kehadiran.map((k, i) => {
                const p = byNip.get(k.pesertaNip)
                return (
                  <tr key={k.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{(page - 1) * PER_PAGE + i + 1}</td>
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

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500">
          Menampilkan {from}-{to} dari {matching} kehadiran
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50">
              Sebelumnya
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-3 py-1.5 font-medium text-slate-300">Sebelumnya</span>
          )}
          <span className="text-slate-500">Halaman {page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50">
              Berikutnya
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-3 py-1.5 font-medium text-slate-300">Berikutnya</span>
          )}
        </div>
      </div>
    </div>
  )
}
