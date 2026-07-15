"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { LayoutDashboard, PenSquare, Users, Shield, History, Upload, type LucideIcon } from "lucide-react"

type Props = { serverSession?: any }

type Item = {
  href: string
  label: string
  icon: LucideIcon
  show: boolean
  match?: (p: string) => boolean
}

export function Sidebar({ serverSession }: Props) {
  const pathname = usePathname()
  const { data: clientSession } = useSession()
  const session = serverSession || clientSession

  const role = session?.user?.role
  const twoFactorEnabled = (session?.user as any)?.twoFactorEnabled

  const isSekretariat =
    role === "SUPERADMIN" ||
    role === "KABAN" ||
    (role === "BIDANG" && session?.user?.bidang === "204.1")

  const items: Item[] = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, show: true, match: (p) => p === "/admin" },
    { href: "/admin/bulk-sign", label: "Bulk Sign", icon: Upload, show: isSekretariat, match: (p) => p.startsWith("/admin/bulk-sign") && !p.startsWith("/admin/bulk-sign-sk") },
    { href: "/admin/bulk-sign-sk", label: "Bulk Sign SK", icon: PenSquare, show: isSekretariat },
    { href: "/admin/riwayat-sign", label: "Riwayat Sign", icon: History, show: isSekretariat },
    { href: "/admin/users", label: "Manage User", icon: Users, show: role === "SUPERADMIN" },
  ]

  function itemClass(active: boolean) {
    return [
      "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
      active
        ? "bg-blue-50 text-blue-700"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    ].join(" ")
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
          <img src="/qr-signer/logo.png" alt="Logo" className="h-5 w-5 object-contain brightness-0 invert" />
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-extrabold tracking-tight text-slate-900">SIGNER</h1>
          <p className="text-[11px] text-slate-400">BKD Jawa Timur</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Menu</p>

        {items.filter((it) => it.show).map((it) => {
          const active = it.match ? it.match(pathname) : pathname.startsWith(it.href)
          const Icon = it.icon
          return (
            <Link key={it.href} href={it.href} className={itemClass(active)}>
              {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />}
              <Icon className={`h-[18px] w-[18px] ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
              <span>{it.label}</span>
            </Link>
          )
        })}

        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Akun</p>

        <Link href="/admin/settings/2fa" className={itemClass(pathname.startsWith("/admin/settings/2fa"))}>
          {pathname.startsWith("/admin/settings/2fa") && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />}
          <Shield className={`h-[18px] w-[18px] ${pathname.startsWith("/admin/settings/2fa") ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
          <span>Keamanan Akun</span>
          {twoFactorEnabled ? (
            <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">2FA On</span>
          ) : (
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">2FA Off</span>
          )}
        </Link>
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
          <img src="/qr-signer/logo-bsre.png" alt="BSrE" className="h-6 w-auto object-contain" />
          <p className="text-[10px] leading-tight text-slate-400">Terintegrasi BSrE BSSN</p>
        </div>
      </div>
    </aside>
  )
}
