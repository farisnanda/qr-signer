import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/mail"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { hashToken } from "@/lib/db-security"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_TTL_MS = 3 * 60 * 60 * 1000
const COOLDOWN_MS = 5 * 60 * 1000
const WINDOW_MS = 60 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 3

type ActivationRate = {
  activationSentAt: Date | null
  activationWindowStart: Date | null
  activationRequestCount: number
}

/** Aktivasi akun peserta: set email + password, kirim email verifikasi. Publik. */
export async function POST(request: Request) {
  const now = new Date()
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

  const [rate] = await prisma.$queryRaw<ActivationRate[]>`
    SELECT
      "activationSentAt",
      "activationWindowStart",
      "activationRequestCount"
    FROM "Peserta"
    WHERE "id" = ${peserta.id}
    LIMIT 1
  `

  if (rate?.activationSentAt && now.getTime() - rate.activationSentAt.getTime() < COOLDOWN_MS) {
    return Response.json(
      { error: "Link aktivasi baru saja dikirim. Silakan tunggu beberapa menit sebelum mencoba lagi." },
      { status: 429 }
    )
  }

  const windowStart = rate?.activationWindowStart ?? null
  const sameWindow = windowStart && now.getTime() - windowStart.getTime() < WINDOW_MS
  const requestCount = sameWindow ? rate?.activationRequestCount ?? 0 : 0
  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    return Response.json(
      { error: "Terlalu banyak permintaan aktivasi. Silakan coba lagi sekitar 1 jam lagi." },
      { status: 429 }
    )
  }

  // Email tidak boleh dipakai peserta lain.
  const emailOwner = await prisma.peserta.findUnique({ where: { email } })
  if (emailOwner && emailOwner.nip !== nip) {
    return Response.json({ error: "Email sudah dipakai peserta lain" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 10)
  const token = randomBytes(32).toString("hex")
  const expires = new Date(now.getTime() + TOKEN_TTL_MS)

  // Kirim email DULU; kalau gagal, JANGAN ubah DB — hindari akun "setengah jadi"
  // (email/token terpasang tapi peserta tak pernah menerima link).
  let mail
  try {
    mail = await sendVerificationEmail(email, peserta.nama, token)
  } catch (err: any) {
    console.error("[aktivasi] gagal kirim email:", err?.message)
    return Response.json(
      { error: "Gagal mengirim email verifikasi. Periksa alamat email lalu coba lagi." },
      { status: 502 }
    )
  }

  await prisma.peserta.update({
    where: { nip },
    data: {
      email,
      password: hashed,
      emailVerified: false,
      verifyToken: hashToken(token),
      verifyExpires: expires,
    },
  })

  await prisma.$executeRaw`
    UPDATE "Peserta"
    SET
      "activationSentAt" = ${now},
      "activationWindowStart" = ${sameWindow ? windowStart : now},
      "activationRequestCount" = ${requestCount + 1}
    WHERE "id" = ${peserta.id}
  `

  // devLink hanya di non-production, agar link verifikasi tak pernah bocor di prod.
  const devLink = process.env.NODE_ENV !== "production" && !mail.sent ? mail.link : undefined

  return Response.json({
    ok: true,
    message: `Link verifikasi telah dikirim ke ${email}. Silakan cek email Anda.`,
    devLink,
  })
}
