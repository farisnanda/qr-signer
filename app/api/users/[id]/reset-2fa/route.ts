import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await headers()
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  await prisma.user.update({
    where: { id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    },
  })

  return NextResponse.json({ success: true })
}