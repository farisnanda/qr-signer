"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { LayoutDashboard, PenSquare, Users, Shield, History, Upload } from "lucide-react"

type Props = { serverSession?: any }

export function Sidebar({ serverSession }: Props) {
  const pathname = usePathname()
  const { data: clientSession } = useSession()
  const session = serverSession || clientSession

  const isSekretariat =
    session?.user?.role === "SUPERADMIN" ||
    session?.user?.role === "KABAN" ||
    (session?.user?.role === "BIDANG" && session?.user?.bidang === "204.1")

  return (
    <aside className="w-64 overflow-y-auto border-r bg-white">
      <div className="border-b p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
            <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900">SIGNER</h1>
            <p className="text-xs text-slate-400">BKD Jawa Timur</p>
          </div>
        </div>
      </div>

      <nav className="space-y-1 p-4">

        <Link href="/admin" className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all ${pathname === "/admin" ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>

        {isSekretariat && (
          <Link href="/admin/bulk-sign" className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all ${pathname.startsWith("/admin/bulk-sign") && !pathname.startsWith("/admin/bulk-sign-sk") ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
            <Upload className="h-4 w-4" />
            <span>Bulk Sign</span>
          </Link>
        )}

        {isSekretariat && (
          <Link href="/admin/bulk-sign-sk" className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all ${pathname.startsWith("/admin/bulk-sign-sk") ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
            <PenSquare className="h-4 w-4" />
            <span>Bulk Sign SK</span>
          </Link>
        )}

        {isSekretariat && (
          <Link href="/admin/riwayat-sign" className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all ${pathname.startsWith("/admin/riwayat-sign") ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
            <History className="h-4 w-4" />
            <span>Riwayat Sign</span>
          </Link>
        )}

        {session?.user?.role === "SUPERADMIN" && (
          <Link href="/admin/users" className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all ${pathname.startsWith("/admin/users") ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
            <Users className="h-4 w-4" />
            <span>Manage User</span>
          </Link>
        )}

        <div className="pt-2 pb-1">
          <p className="px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Akun</p>
        </div>

        <Link href="/admin/settings/2fa" className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all ${pathname.startsWith("/admin/settings/2fa") ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
          <Shield className="h-4 w-4" />
          <span>Keamanan Akun</span>
          {(session?.user as any)?.twoFactorEnabled ? (
            <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">2FA On</span>
          ) : (
            <span className="ml-auto rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-600">2FA Off</span>
          )}
        </Link>

      </nav>
    </aside>
  )
}