import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"
import QRCode from "qrcode"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id

  // Generate secret baru
  const secret = new OTPAuth.Secret({ size: 20 })
  const secretBase32 = secret.base32

  // Simpan secret sementara ke DB (belum enabled)
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secretBase32 },
  })

  // Buat TOTP
  const totp = new OTPAuth.TOTP({
    issuer: "SIGNER BKD Jawa Timur",
    label: session.user.email ?? "user",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })

  const otpAuthUrl = totp.toString()
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

  return NextResponse.json({
    secret: secretBase32,
    qrCode: qrCodeDataUrl,
    otpAuthUrl,
  })
}