import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const name = session.user.name ?? session.user.email ?? "User"
  const email = session.user.email!
  const role = (session.user as any).role

  const now = new Date()
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7)

  const batchWhere = role === "SUPERADMIN" ? {} : { signedBy: email }

  const [
    totalBatch,
    batchHariIni,
    batchMingguIni,
    totalDokumen,
    totalBulkSign,
    totalBulkSignSk,
    dokumenGagal,
    batchTerbaru,
    topSUPER,
  ] = await Promise.all([
    prisma.signBatch.count({ where: batchWhere }),
    prisma.signBatch.count({ where: { ...batchWhere, createdAt: { gte: startOfDay } } }),
    prisma.signBatch.count({ where: { ...batchWhere, createdAt: { gte: startOfWeek } } }),
    prisma.signLog.count({ where: { ...batchWhere, status: "success" } }),
    prisma.signBatch.count({ where: { ...batchWhere, jenisSk: "BULK_SIGN" } }),
    prisma.signBatch.count({ where: { ...batchWhere, jenisSk: { not: "BULK_SIGN" } } }),
    prisma.signLog.count({ where: { ...batchWhere, status: "error" } }),
    prisma.signBatch.findMany({
      where: batchWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    role === "SUPERADMIN"
      ? prisma.signBatch.groupBy({
          by: ["signedBy"],
          _count: { id: true },
          _sum: { total: true },
          orderBy: { _sum: { total: "desc" } },
          take: 5,
        })
      : Promise.resolve([]),
  ])

  const successRate = totalDokumen + dokumenGagal > 0
    ? Math.round((totalDokumen / (totalDokumen + dokumenGagal)) * 100)
    : 0

  function formatTime(date: Date) {
    return new Date(date).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-slate-500">Selamat datang, <span className="font-medium text-slate-700">{name}</span></p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Dokumen Signed</p>
          <p className="mt-2 text-4xl font-black text-slate-900">{totalDokumen.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">Dokumen berhasil ditandatangani</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Batch Hari Ini</p>
          <p className="mt-2 text-4xl font-black text-blue-600">{batchHariIni.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">{batchMingguIni} batch dalam 7 hari terakhir</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Success Rate</p>
          <p className={`mt-2 text-4xl font-black ${successRate >= 90 ? "text-green-600" : successRate >= 70 ? "text-yellow-600" : "text-red-600"}`}>
            {successRate}%
          </p>
          <p className="mt-1 text-xs text-slate-400">{dokumenGagal} dokumen gagal</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Batch</p>
          <p className="mt-2 text-4xl font-black text-slate-900">{totalBatch.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">{totalBulkSign} Bulk Sign · {totalBulkSignSk} Bulk SK</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-bold text-slate-800">Batch Terbaru</h2>
            <Link href="/admin/riwayat-sign" className="text-xs text-blue-600 hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="divide-y">
            {batchTerbaru.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Belum ada aktivitas</div>
            )}
            {batchTerbaru.map((batch) => (
              <div key={batch.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{batch.batchCode}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      batch.jenisSk === "BULK_SIGN" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {batch.jenisSk === "BULK_SIGN" ? "Bulk Sign" : batch.jenisSk}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{formatTime(batch.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-sm font-bold text-green-600">{batch.successCount}</p>
                    <p className="text-[10px] text-slate-400">berhasil</p>
                  </div>
                  {batch.errorCount > 0 && (
                    <div>
                      <p className="text-sm font-bold text-red-600">{batch.errorCount}</p>
                      <p className="text-[10px] text-slate-400">gagal</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {role === "SUPERADMIN" && (topSUPER as any[]).length > 0 ? (
          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="border-b px-5 py-4">
              <h2 className="font-bold text-slate-800">Top Penanda Tangan</h2>
              <p className="text-xs text-slate-400">Berdasarkan total dokumen</p>
            </div>
            <div className="divide-y">
              {(topSUPER as any[]).map((item, idx) => (
                <div key={item.signedBy} className="flex items-center gap-4 px-5 py-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0 ? "bg-yellow-100 text-yellow-700" :
                    idx === 1 ? "bg-slate-100 text-slate-600" :
                    idx === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-slate-50 text-slate-400"
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.signedBy}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-800"
                        style={{
                          width: `${Math.round(((item._sum?.total || 0) / ((topSUPER as any[])[0]._sum?.total || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-800">{(item._sum?.total || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400">{item._count.id} batch</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="border-b px-5 py-4">
              <h2 className="font-bold text-slate-800">Akses Cepat</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <Link href="/admin/bulk-sign" className="rounded-xl border p-4 hover:bg-slate-50 transition text-center">
                <p className="text-2xl mb-2">📄</p>
                <p className="text-sm font-medium text-slate-700">Bulk Sign</p>
              </Link>
              <Link href="/admin/bulk-sign-sk" className="rounded-xl border p-4 hover:bg-slate-50 transition text-center">
                <p className="text-2xl mb-2">✍️</p>
                <p className="text-sm font-medium text-slate-700">Bulk Sign SK</p>
              </Link>
              <Link href="/admin/riwayat-sign" className="rounded-xl border p-4 hover:bg-slate-50 transition text-center">
                <p className="text-2xl mb-2">📋</p>
                <p className="text-sm font-medium text-slate-700">Riwayat Sign</p>
              </Link>
              <Link href="/admin/settings/2fa" className="rounded-xl border p-4 hover:bg-slate-50 transition text-center">
                <p className="text-2xl mb-2">🔐</p>
                <p className="text-sm font-medium text-slate-700">Keamanan Akun</p>
              </Link>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Badan Kepegawaian Daerah Provinsi Jawa Timur
      </p>
    </div>
  )
}