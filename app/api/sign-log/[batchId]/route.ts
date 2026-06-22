import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"

const LOGS_PER_PAGE = 10

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  await headers()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { batchId } = await params
  const { searchParams } = req.nextUrl
  const logPage = Math.max(1, Number(searchParams.get("page") || 1))

  const [totalLogs, logs] = await Promise.all([
    prisma.signLog.count({ where: { batchId } }),
    prisma.signLog.findMany({
      where: { batchId },
      orderBy: { signedAt: "asc" },
      skip: (logPage - 1) * LOGS_PER_PAGE,
      take: LOGS_PER_PAGE,
      select: {
        id: true,
        namaFile: true,
        status: true,
        errorMessage: true,
        signedAt: true,
      },
    }),
  ])

  return NextResponse.json({
    logs,
    totalLogs,
    totalPages: Math.ceil(totalLogs / LOGS_PER_PAGE),
    page: logPage,
  })
}