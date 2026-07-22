import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { utils, write } from "xlsx"

/** Export rekap kehadiran satu sesi ke Excel (admin). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as any)?.kind === "peserta") {
    return new Response("Unauthorized", { status: 401 })
  }

  const { id } = await params
  const sesi = await prisma.sesi.findUnique({
    where: { id },
    include: { kehadiran: { orderBy: { checkedInAt: "asc" } } },
  })
  if (!sesi) return new Response("Sesi tidak ditemukan", { status: 404 })

  // Lengkapi dgn data profil peserta (pangkat, perangkat daerah).
  const nips = sesi.kehadiran.map((k) => k.pesertaNip)
  const peserta = await prisma.peserta.findMany({ where: { nip: { in: nips } } })
  const byNip = new Map(peserta.map((p) => [p.nip, p]))

  const rows = sesi.kehadiran.map((k, i) => {
    const p = byNip.get(k.pesertaNip)
    return {
      No: i + 1,
      NIP: k.pesertaNip,
      Nama: k.pesertaNama,
      Pangkat: p?.pangkat ?? "",
      "Perangkat Daerah": p?.perangkatDaerah ?? "",
      Agama: p?.agama ?? "",
      "Waktu Absen": k.checkedInAt.toLocaleString("id-ID"),
      "Dokumen Dibuat": k.dokumenKey ? "Ya" : "Belum",
    }
  })

  const ws = utils.json_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, "Kehadiran")
  const buf: Buffer = write(wb, { type: "buffer", bookType: "xlsx" })

  const safeName = sesi.nama.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40)
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Kehadiran_${safeName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
