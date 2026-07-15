import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { FileCheck2, CalendarDays, TrendingUp, Layers, Upload, PenSquare, History, Shield, Trophy, type LucideIcon } from "lucide-react"

type Tone = "blue" | "violet" | "green" | "slate" | "amber" | "red"

const TONES: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  green: "bg-green-50 text-green-600",
  slate: "bg-slate-100 text-slate-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
}

function StatCard({ icon: Icon, label, value, sub, tone }: {
  icon: LucideIcon; label: string; value: string | number; sub?: string; tone: Tone
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

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
  const rateTone: Tone = successRate >= 90 ? "green" : successRate >= 70 ? "amber" : "red"

  function formatTime(date: Date) {
    return new Date(date).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  const quickLinks = [
    { href: "/admin/bulk-sign", label: "Bulk Sign", icon: Upload, tone: "blue" as Tone },
    { href: "/admin/bulk-sign-sk", label: "Bulk Sign SK", icon: PenSquare, tone: "violet" as Tone },
    { href: "/admin/riwayat-sign", label: "Riwayat Sign", icon: History, tone: "amber" as Tone },
    { href: "/admin/settings/2fa", label: "Keamanan Akun", icon: Shield, tone: "green" as Tone },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Selamat datang kembali, <span className="font-medium text-slate-700">{name}</span> 👋
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileCheck2} tone="blue" value={totalDokumen.toLocaleString()} label="Total Dokumen Signed" sub="Berhasil ditandatangani" />
        <StatCard icon={CalendarDays} tone="violet" value={batchHariIni.toLocaleString()} label="Batch Hari Ini" sub={`${batchMingguIni} batch dalam 7 hari`} />
        <StatCard icon={TrendingUp} tone={rateTone} value={`${successRate}%`} label="Success Rate" sub={`${dokumenGagal} dokumen gagal`} />
        <StatCard icon={Layers} tone="slate" value={totalBatch.toLocaleString()} label="Total Batch" sub={`${totalBulkSign} Bulk Sign · ${totalBulkSignSk} Bulk SK`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Batch Terbaru */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-800">Batch Terbaru</h2>
            <Link href="/admin/riwayat-sign" className="text-xs font-medium text-blue-600 hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {batchTerbaru.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-slate-400">Belum ada aktivitas</div>
            )}
            {batchTerbaru.map((batch) => (
              <div key={batch.id} className="flex items-center justify-between px-5 py-3.5 transition hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{batch.batchCode}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      batch.jenisSk === "BULK_SIGN" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                    }`}>
                      {batch.jenisSk === "BULK_SIGN" ? "Bulk Sign" : batch.jenisSk}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{formatTime(batch.createdAt)}</p>
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

        {/* Top Penanda Tangan / Akses Cepat */}
        {role === "SUPERADMIN" && (topSUPER as any[]).length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <Trophy className="h-4 w-4 text-amber-500" />
              <div>
                <h2 className="font-bold text-slate-800">Top Penanda Tangan</h2>
                <p className="text-xs text-slate-400">Berdasarkan total dokumen</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {(topSUPER as any[]).map((item, idx) => (
                <div key={item.signedBy} className="flex items-center gap-4 px-5 py-3.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0 ? "bg-amber-100 text-amber-700" :
                    idx === 1 ? "bg-slate-100 text-slate-600" :
                    idx === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-slate-50 text-slate-400"
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{item.signedBy}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.round(((item._sum?.total || 0) / ((topSUPER as any[])[0]._sum?.total || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-800">{(item._sum?.total || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400">{item._count.id} batch</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-800">Akses Cepat</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {quickLinks.map((q) => {
                const Icon = q.icon
                return (
                  <Link key={q.href} href={q.href} className="group rounded-xl border border-slate-200 p-4 text-center transition hover:border-blue-200 hover:bg-blue-50/40">
                    <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${TONES[q.tone]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{q.label}</p>
                  </Link>
                )
              })}
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
