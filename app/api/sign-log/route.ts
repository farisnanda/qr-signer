import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { requireAdminRole } from "@/lib/security"

export async function GET() {
  await headers()
  const session = await requireAdminRole()
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
