import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { KoreksiForm } from "@/components/peserta/koreksi-form"

export const dynamic = "force-dynamic"

const FIELD_LABEL: Record<string, string> = {
  nama: "Nama",
  agama: "Agama",
  pangkat: "Pangkat",
  perangkatDaerah: "Perangkat Daerah",
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Disetujui", cls: "bg-green-100 text-green-700" },
  rejected: { label: "Ditolak", cls: "bg-red-100 text-red-700" },
}

export default async function KoreksiPage() {
  const session = await getServerSession(authOptions)
  const nip = (session?.user as any)?.nip
  if (!nip) redirect("/peserta/login")

  const peserta = await prisma.peserta.findUnique({
    where: { nip },
    select: { nama: true, agama: true, pangkat: true, perangkatDaerah: true },
  })
  if (!peserta) redirect("/peserta/login")

  const riwayat = await prisma.koreksiData.findMany({
    where: { pesertaNip: nip },
    orderBy: { createdAt: "desc" },
    take: 10,
  })
  const hasPending = riwayat.some((r) => r.status === "pending")

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Ajukan Perbaikan Data</h2>
          <Link href="/peserta" className="text-xs font-medium text-slate-500 hover:underline">← Kembali</Link>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Temukan kesalahan pada data Anda (nama/gelar, agama, pangkat, atau perangkat daerah)? Ajukan perbaikan di sini.
          Permintaan akan diperiksa panitia terlebih dahulu.
        </p>
        <KoreksiForm peserta={peserta} hasPending={hasPending} />
      </div>

      {riwayat.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Riwayat Pengajuan</h3>
          <div className="space-y-3">
            {riwayat.map((r) => {
              const b = STATUS_BADGE[r.status]
              return (
                <div key={r.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-800">{FIELD_LABEL[r.field] || r.field}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    "{r.nilaiLama}" → "{r.nilaiDiminta}"
                  </p>
                  {r.catatanAdmin && (
                    <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">Catatan panitia: {r.catatanAdmin}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
