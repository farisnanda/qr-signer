import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"

export async function GET() {
  await headers()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const email = session.user.email!

  // Ambil 10 batch terbaru milik user ini
  const batches = await prisma.signBatch.findMany({
    where: { signedBy: email },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      logs: {
        where: { status: "error" },
        take: 5,
      },
    },
  })

  return NextResponse.json({ batches })
}