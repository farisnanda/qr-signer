import { prisma } from "@/lib/prisma"

/** Cek status NIP untuk memandu alur aktivasi (langkah 1). Publik. */
export async function POST(request: Request) {
  const { nip } = await request.json().catch(() => ({ nip: "" }))
  const clean = String(nip || "").trim()
  if (!clean) {
    return Response.json({ error: "NIP wajib diisi" }, { status: 400 })
  }

  const peserta = await prisma.peserta.findUnique({
    where: { nip: clean },
    select: { nama: true, email: true, emailVerified: true },
  })

  if (!peserta) {
    return Response.json({ exists: false }, { status: 404 })
  }

  const status = peserta.emailVerified ? "aktif" : peserta.email ? "pending" : "belum"
  return Response.json({ exists: true, nama: peserta.nama, status })
}
