"use client"

import { signOut, useSession } from "next-auth/react"
import { useState, useEffect, useRef } from "react"
import { Bell, LogOut } from "lucide-react"
import Link from "next/link"

type Batch = {
  id: string
  jenisSk: string
  total: number
  successCount: number
  errorCount: number
  zipFileName: string | null
  createdAt: string
  logs: { id: string; nama: string | null; nip: string | null; errorMessage: string | null }[]
}

export function Navbar() {
  const { data: session } = useSession()
  const [batches, setBatches] = useState<Batch[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const name = session?.user?.name || session?.user?.email || "User"
  const role = (session?.user as any)?.role || ""
  const initial = name.charAt(0).toUpperCase()

  useEffect(() => {
    fetchNotif()
    const interval = setInterval(fetchNotif, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function fetchNotif() {
    try {
      const res = await fetch("/qr-signer/api/sign-log")
      const data = await res.json()
      if (data.batches) {
        setBatches(data.batches)
        const saved = localStorage.getItem("notif_last_read")
        const unread = data.batches.filter((b: Batch) =>
          !saved || new Date(b.createdAt) > new Date(saved)
        ).length
        setUnreadCount(unread)
      }
    } catch {}
  }

  function handleOpenNotif() {
    setShowNotif(!showNotif)
    if (!showNotif) {
      localStorage.setItem("notif_last_read", new Date().toISOString())
      setUnreadCount(0)
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 md:hidden">SIGNER</span>
        <p className="hidden text-sm text-slate-400 md:block">
          Selamat datang, <span className="font-semibold text-slate-700">{name}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Bell Notifikasi */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleOpenNotif}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-bold text-slate-800">Riwayat Sign</p>
                <Link href="/admin/riwayat-sign" className="text-xs font-medium text-blue-600 hover:underline"
                  onClick={() => setShowNotif(false)}>
                  Lihat semua
                </Link>
              </div>
              <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {batches.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">Belum ada riwayat sign</div>
                )}
                {batches.map((batch) => (
                  <div key={batch.id} className="px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700">{batch.jenisSk} — {batch.total} dokumen</p>
                        <p className="mt-0.5 text-xs text-slate-400">{formatTime(batch.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {batch.successCount > 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            ✓ {batch.successCount} berhasil
                          </span>
                        )}
                        {batch.errorCount > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            ✗ {batch.errorCount} gagal
                          </span>
                        )}
                      </div>
                    </div>
                    {batch.logs.length > 0 && (
                      <div className="mt-1.5 rounded-lg bg-red-50 px-2 py-1.5">
                        <p className="mb-0.5 text-[10px] font-medium text-red-600">Dokumen gagal:</p>
                        {batch.logs.map(log => (
                          <p key={log.id} className="text-[10px] text-red-500">• {log.nama} ({log.nip})</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profil */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 py-1 pl-1 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            {initial}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="max-w-[140px] truncate text-xs font-semibold text-slate-700">{name}</p>
            {role && <p className="text-[10px] text-slate-400">{role}</p>}
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/qr-signer/login" })}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-sm font-medium text-red-600 transition hover:bg-red-100"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
