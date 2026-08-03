import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"
import QRCode from "qrcode"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as any).kind === "peserta") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (user.twoFactorEnabled) return NextResponse.json({ error: "2FA sudah aktif" }, { status: 409 })

  const secret = new OTPAuth.Secret({ size: 20 })
  const secretBase32 = secret.base32

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secretBase32 },
  })

  const totp = new OTPAuth.TOTP({
    issuer: "SIGNER BKD Jawa Timur",
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })

  const otpAuthUrl = totp.toString()
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

  return NextResponse.json({ secret: secretBase32, qrCode: qrCodeDataUrl })
}
