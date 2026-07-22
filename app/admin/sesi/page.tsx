import { prisma } from "@/lib/prisma"
import { SesiManager } from "@/components/sesi/sesi-manager"

export const dynamic = "force-dynamic"

export default async function SesiPage() {
  const sesiList = await prisma.sesi.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { kehadiran: true } } },
    take: 100,
  })

  const data = sesiList.map((s) => ({
    id: s.id,
    nama: s.nama,
    pin: s.pin,
    aktif: s.aktif,
    hadir: s._count.kehadiran,
    createdAt: s.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sesi Pengambilan Sumpah</h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat sesi dan bagikan PIN ke peserta yang hadir. Peserta memasukkan PIN saat generate Berita Acara sebagai bukti kehadiran.
        </p>
      </div>

      <SesiManager initial={data} />
    </div>
  )
}
