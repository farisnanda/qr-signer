import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ twoFactorEnabled: false })

  const user = await prisma.user.findUnique({
    where: { email },
    select: { twoFactorEnabled: true },
  })

  return NextResponse.json({
    twoFactorEnabled: user?.twoFactorEnabled ?? false,
  })
}