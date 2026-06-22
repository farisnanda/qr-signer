import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"
import { encode } from "next-auth/jwt"

export async function POST(req: Request) {
  const { email, code } = await req.json()
  if (!email || !code) {
    return NextResponse.json({ error: "Email dan kode wajib diisi" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.twoFactorSecret) {
    return NextResponse.json({ error: "Secret tidak ditemukan" }, { status: 400 })
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

  await prisma.user.update({
    where: { email },
    data: { twoFactorEnabled: true },
  })

  const now = Math.floor(Date.now() / 1000)
  const newToken = await encode({
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      bidang: user.bidang ?? undefined,
      twoFactorEnabled: true,
      twoFactorVerified: true,
      iat: now,
      exp: now + 8 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET!,
  })

  const isProduction = process.env.NODE_ENV === "production"
  const cookieName = isProduction
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token"

  const response = NextResponse.json({ success: true })
  response.cookies.set(cookieName, newToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  })

  return response
}