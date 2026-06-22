import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"
import QRCode from "qrcode"

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })

  // Generate secret baru
  const secret = new OTPAuth.Secret({ size: 20 })
  const secretBase32 = secret.base32

  // Simpan secret sementara ke DB
  await prisma.user.update({
    where: { email },
    data: { twoFactorSecret: secretBase32 },
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