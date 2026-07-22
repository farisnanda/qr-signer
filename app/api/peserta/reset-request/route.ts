import { prisma } from "@/lib/prisma"
import { sendResetEmail } from "@/lib/mail"
import { randomBytes } from "crypto"

/** Minta reset password via NIP. Publik. Respons generik agar tak membocorkan
 * NIP mana yang terdaftar. */
export async function POST(request: Request) {
  const { nip } = await request.json().catch(() => ({ nip: "" }))
  const clean = String(nip || "").trim()
  if (!clean) {
    return Response.json({ error: "NIP wajib diisi" }, { status: 400 })
  }

  const generic = "Jika NIP terdaftar dan sudah aktif, link reset dikirim ke email terdaftar."
  const peserta = await prisma.peserta.findUnique({ where: { nip: clean } })

  // Hanya kirim kalau peserta ada, sudah punya email, dan terverifikasi.
  if (!peserta || !peserta.email || !peserta.emailVerified) {
    return Response.json({ ok: true, message: generic })
  }

  const token = randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  // Kirim email DULU; kalau gagal, jangan persist token & tetap respons generik
  // (jangan bocorkan bahwa NIP ini terdaftar).
  let mail
  try {
    mail = await sendResetEmail(peserta.email, peserta.nama, token)
  } catch (err: any) {
    console.error("[reset-request] gagal kirim email:", err?.message)
    return Response.json({ ok: true, message: generic })
  }

  await prisma.peserta.update({
    where: { id: peserta.id },
    data: { resetToken: token, resetExpires: expires },
  })

  const devLink = process.env.NODE_ENV !== "production" && !mail.sent ? mail.link : undefined
  return Response.json({
    ok: true,
    message: generic,
    devLink,
  })
}
