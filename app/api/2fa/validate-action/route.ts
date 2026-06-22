import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"
import { headers } from "next/headers"

export async function POST(req: NextRequest) {
  await headers()
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { code } = await req.json()
  const email = session.user.email!

  if (!code) {
    return NextResponse.json({ error: "Kode wajib diisi" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Kalau user tidak punya 2FA aktif, langsung izinkan
  if (!user?.twoFactorEnabled || !user?.twoFactorSecret) {
    return NextResponse.json({ success: true })
  }

  const totp = new OTPAuth.TOTP({
    issuer: "SIGNER BKD Jawa Timur",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
  })

  const delta = totp.validate({ token: code, window: 1 })
  if (delta === null) {
    return NextResponse.json({ error: "Kode tidak valid" }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}