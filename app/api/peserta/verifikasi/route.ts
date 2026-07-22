import { prisma } from "@/lib/prisma"

/** Verifikasi email via token. Publik. */
export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({ token: "" }))
  const clean = String(token || "").trim()
  if (!clean) {
    return Response.json({ error: "Token tidak ada" }, { status: 400 })
  }

  const peserta = await prisma.peserta.findUnique({ where: { verifyToken: clean } })
  if (!peserta) {
    return Response.json({ error: "Token tidak valid atau sudah dipakai" }, { status: 400 })
  }
  if (peserta.verifyExpires && peserta.verifyExpires < new Date()) {
    return Response.json({ error: "Token sudah kedaluwarsa. Silakan aktivasi ulang." }, { status: 410 })
  }

  await prisma.peserta.update({
    where: { id: peserta.id },
    data: { emailVerified: true, verifyToken: null, verifyExpires: null },
  })

  return Response.json({ ok: true, nama: peserta.nama })
}
