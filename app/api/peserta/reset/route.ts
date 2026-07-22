import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

/** Set password baru via token reset. Publik. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const token = String(body.token || "").trim()
  const password = String(body.password || "")

  if (!token) {
    return Response.json({ error: "Token tidak ada" }, { status: 400 })
  }
  if (password.length < 6) {
    return Response.json({ error: "Password minimal 6 karakter" }, { status: 400 })
  }

  const peserta = await prisma.peserta.findUnique({ where: { resetToken: token } })
  if (!peserta) {
    return Response.json({ error: "Token tidak valid atau sudah dipakai" }, { status: 400 })
  }
  if (peserta.resetExpires && peserta.resetExpires < new Date()) {
    return Response.json({ error: "Token sudah kedaluwarsa. Minta reset ulang." }, { status: 410 })
  }

  const hashed = await bcrypt.hash(password, 10)
  await prisma.peserta.update({
    where: { id: peserta.id },
    data: { password: hashed, resetToken: null, resetExpires: null },
  })

  return Response.json({ ok: true })
}
