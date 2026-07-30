import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeAgama } from "@/lib/agama"
import { normalizePangkat } from "@/lib/pangkat"

const FIELD_VALID = ["nama", "agama", "pangkat", "perangkatDaerah"] as const
type Field = (typeof FIELD_VALID)[number]

function currentValue(peserta: any, field: Field): string {
  return String(peserta[field] ?? "")
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const nip = (session?.user as any)?.nip
  if (!nip || (session?.user as any)?.kind !== "peserta") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const list = await prisma.koreksiData.findMany({
    where: { pesertaNip: nip },
    orderBy: { createdAt: "desc" },
  })
  return Response.json({ list })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const nip = (session?.user as any)?.nip
  if (!nip || (session?.user as any)?.kind !== "peserta") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const field = String(body.field || "") as Field
  const nilaiDiminta = String(body.nilaiDiminta || "").trim()
  const alasan = String(body.alasan || "").trim()

  if (!FIELD_VALID.includes(field)) {
    return Response.json({ error: "Jenis perbaikan tidak valid" }, { status: 400 })
  }
  if (!nilaiDiminta) {
    return Response.json({ error: "Nilai baru wajib diisi" }, { status: 400 })
  }

  const peserta = await prisma.peserta.findUnique({ where: { nip } })
  if (!peserta) {
    return Response.json({ error: "Data peserta tidak ditemukan" }, { status: 404 })
  }

  const nilaiLama = currentValue(peserta, field)
  if (nilaiDiminta === nilaiLama) {
    return Response.json({ error: "Nilai baru sama dengan data saat ini" }, { status: 400 })
  }

  // Cegah spam: satu permintaan pending pada satu waktu.
  const pending = await prisma.koreksiData.findFirst({
    where: { pesertaNip: nip, status: "pending" },
  })
  if (pending) {
    return Response.json(
      { error: "Anda masih memiliki permintaan koreksi yang menunggu keputusan panitia." },
      { status: 409 }
    )
  }

  const koreksi = await prisma.koreksiData.create({
    data: { pesertaNip: nip, field, nilaiLama, nilaiDiminta, alasan: alasan || null },
  })

  return Response.json({ ok: true, koreksi })
}
