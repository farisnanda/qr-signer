import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import RiwayatSignClient from "./client"

const PER_PAGE = 10

export default async function RiwayatSignPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const email = session.user.email!
  const role = (session.user as any).role
  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1))
  const where = role === "SUPERADMIN" ? {} : { signedBy: email }

  const [totalBatches, batches] = await Promise.all([
    prisma.signBatch.count({ where }),
    prisma.signBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      // Tidak include logs — fetch lazy via API
      select: {
        id: true,
        batchCode: true,
        jenisSk: true,
        total: true,
        successCount: true,
        errorCount: true,
        zipFileName: true,
        reportFileName: true,
        signedBy: true,
        createdAt: true,
      },
    }),
  ])

  const totalPages = Math.ceil(totalBatches / PER_PAGE)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Riwayat Sign</h1>
        <p className="mt-1 text-sm text-slate-500">Daftar batch signing yang sudah diproses.</p>
      </div>

      <RiwayatSignClient
        batches={batches as any}
        page={page}
        totalPages={totalPages}
        totalBatches={totalBatches}
      />
    </div>
  )
}