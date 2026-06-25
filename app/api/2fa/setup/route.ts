import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"
import QRCode from "qrcode"

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const secret = new OTPAuth.Secret({ size: 20 })
  const secretBase32 = secret.base32

  await prisma.user.update({
    where: { id: user.id },
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

  const otpAuthUrl = totp.toString()
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

  return NextResponse.json({ secret: secretBase32, qrCode: qrCodeDataUrl })
}