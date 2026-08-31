"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Wrench } from "lucide-react"

type Props = {
  initialMessage: string | null
  initialActiveAgainAt: string | null // ISO string
}

type Remaining = { hari: number; jam: number; menit: number; detik: number; done: boolean }

function computeRemaining(targetIso: string | null): Remaining {
  if (!targetIso) return { hari: 0, jam: 0, menit: 0, detik: 0, done: false }
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return { hari: 0, jam: 0, menit: 0, detik: 0, done: true }
  const detikTotal = Math.floor(diff / 1000)
  return {
    hari: Math.floor(detikTotal / 86400),
    jam: Math.floor((detikTotal % 86400) / 3600),
    menit: Math.floor((detikTotal % 3600) / 60),
    detik: detikTotal % 60,
    done: false,
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

export function MaintenanceCountdown({ initialMessage, initialActiveAgainAt }: Props) {
  const router = useRouter()
  const [message, setMessage] = useState(initialMessage)
  const [activeAgainAt, setActiveAgainAt] = useState(initialActiveAgainAt)
  const [remaining, setRemaining] = useState<Remaining>(() => computeRemaining(initialActiveAgainAt))

  // Tick tiap detik buat countdown visual.
  useEffect(() => {
    const id = setInterval(() => setRemaining(computeRemaining(activeAgainAt)), 1000)
    return () => clearInterval(id)
  }, [activeAgainAt])

  // Poll status asli ke server tiap 20 detik — begitu admin matiin
  // maintenance (atau waktu target lewat), auto redirect ke login.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/qr-signer/api/peserta/maintenance-status", { cache: "no-store" })
        const data = await res.json()
        if (!data.active) {
          router.push("/peserta/login")
          router.refresh()
          return
        }
        setMessage(data.message)
        setActiveAgainAt(data.activeAgainAt)
      } catch {
        // Koneksi gagal, biarin — coba lagi di tick berikutnya.
      }
    }, 20000)
    return () => clearInterval(id)
  }, [router])

  useEffect(() => {
    if (remaining.done) {
      router.push("/peserta/login")
      router.refresh()
    }
  }, [remaining.done, router])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/50">
      <div className="border-b border-blue-200 bg-gradient-to-br from-blue-700 via-cyan-700 to-teal-700 px-5 py-8 text-center text-white sm:px-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-4 ring-white/20">
          <Wrench className="h-8 w-8 animate-[spin_3s_linear_infinite] text-white" />
        </div>
        <h2 className="text-2xl font-black tracking-tight">Sedang Dalam Perbaikan</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-100">
          {message || "Portal peserta sedang dalam pemeliharaan. Mohon coba lagi nanti."}
        </p>
      </div>

      <div className="px-5 py-6 sm:px-6">
        {activeAgainAt && !remaining.done ? (
          <>
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
              Aktif kembali dalam
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Hari", value: remaining.hari },
                { label: "Jam", value: remaining.jam },
                { label: "Menit", value: remaining.menit },
                { label: "Detik", value: remaining.detik },
              ].map((it) => (
                <div
                  key={it.label}
                  className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 py-3"
                >
                  <span className="text-2xl font-black tabular-nums text-blue-950">{pad(it.value)}</span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {it.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-center text-sm font-semibold text-slate-600">
            Halaman akan aktif kembali sebentar lagi. Mohon tunggu...
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500" />
        </div>
      </div>
    </div>
  )
}
