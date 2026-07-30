import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** Daftar permintaan koreksi data (admin). ?status=pending|approved|rejected */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as any)?.kind === "peserta") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = new URL(request.url).searchParams.get("status")
  const where = status && ["pending", "approved", "rejected"].includes(status) ? { status } : {}

  const list = await prisma.koreksiData.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { peserta: { select: { nama: true, email: true, perangkatDaerah: true } } },
    take: 200,
  })
  return Response.json({ list })
}
