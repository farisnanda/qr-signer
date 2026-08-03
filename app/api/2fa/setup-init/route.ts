import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"
import QRCode from "qrcode"
import bcrypt from "bcryptjs"
import { encryptTwoFactorSecret } from "@/lib/db-security"

export async function POST(req: Request) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.password) return NextResponse.json({ error: "Login tidak valid" }, { status: 401 })

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) return NextResponse.json({ error: "Login tidak valid" }, { status: 401 })

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA sudah aktif" }, { status: 409 })
  }

  const secret = new OTPAuth.Secret({ size: 20 })
  const secretBase32 = secret.base32

  await prisma.user.update({
    where: { email },
    data: { twoFactorSecret: encryptTwoFactorSecret(secretBase32) },
  })

  const totp = new OTPAuth.TOTP({
    issuer: "SIGNER BKD Jawa Timur",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })

  const qrCodeDataUrl = await QRCode.toDataURL(totp.toString())
  return NextResponse.json({ secret: secretBase32, qrCode: qrCodeDataUrl })
}
