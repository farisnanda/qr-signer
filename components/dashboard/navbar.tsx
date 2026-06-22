"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef } from "react"
import { Bell } from "lucide-react"
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
  const [batches, setBatches] = useState<Batch[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
      const res = await fetch("/api/sign-log")
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
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <h2 className="text-lg font-semibold">SIGNER</h2>

      <div className="flex items-center gap-3">
        {/* Bell Notifikasi */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleOpenNotif}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border hover:bg-slate-50 transition"
          >
            <Bell className="h-4 w-4 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border bg-white shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="font-bold text-sm text-slate-800">Riwayat Sign</p>
                <Link href="/admin/riwayat-sign" className="text-xs text-blue-600 hover:underline"
                  onClick={() => setShowNotif(false)}>
                  Lihat semua
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y">
                {batches.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">Belum ada riwayat sign</div>
                )}
                {batches.map((batch) => (
                  <div key={batch.id} className="px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700">{batch.jenisSk} — {batch.total} dokumen</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatTime(batch.createdAt)}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
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
                        <p className="text-[10px] font-medium text-red-600 mb-0.5">Dokumen gagal:</p>
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

        <Button variant="destructive" onClick={() => signOut({ callbackUrl: "/login" })}>
          Logout
        </Button>
      </div>
    </header>
  )
}