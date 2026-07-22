import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/mail"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Aktivasi akun peserta: set email + password, kirim email verifikasi. Publik. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const nip = String(body.nip || "").trim()
  const email = String(body.email || "").trim().toLowerCase()
  const password = String(body.password || "")

  if (!nip || !email || !password) {
    return Response.json({ error: "NIP, email, dan password wajib diisi" }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Format email tidak valid" }, { status: 400 })
  }
  if (password.length < 6) {
    return Response.json({ error: "Password minimal 6 karakter" }, { status: 400 })
  }

  const peserta = await prisma.peserta.findUnique({ where: { nip } })
  if (!peserta) {
    return Response.json({ error: "NIP tidak terdaftar sebagai peserta" }, { status: 404 })
  }
  if (peserta.emailVerified) {
    return Response.json({ error: "Akun sudah aktif. Silakan login." }, { status: 409 })
  }

  // Email tidak boleh dipakai peserta lain.
  const emailOwner = await prisma.peserta.findUnique({ where: { email } })
  if (emailOwner && emailOwner.nip !== nip) {
    return Response.json({ error: "Email sudah dipakai peserta lain" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 10)
  const token = randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.peserta.update({
    where: { nip },
    data: {
      email,
      password: hashed,
      emailVerified: false,
      verifyToken: token,
      verifyExpires: expires,
    },
  })

  const mail = await sendVerificationEmail(email, peserta.nama, token)

  // devLink hanya di non-production, agar link verifikasi tak pernah bocor di prod.
  const devLink = process.env.NODE_ENV !== "production" && !mail.sent ? mail.link : undefined

  return Response.json({
    ok: true,
    message: `Link verifikasi telah dikirim ke ${email}. Silakan cek email Anda.`,
    devLink,
  })
}
