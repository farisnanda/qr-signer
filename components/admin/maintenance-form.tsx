"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Wrench } from "lucide-react"

type Props = {
  initialActive: boolean
  initialMessage: string | null
  initialActiveAgainAt: string | null // ISO
}

// datetime-local butuh format "YYYY-MM-DDTHH:mm" di TIMEZONE LOKAL browser,
// bukan UTC — kalau langsung .toISOString().slice(0,16) hasilnya geser jam.
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const tzOffsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16)
}

export function MaintenanceForm({ initialActive, initialMessage, initialActiveAgainAt }: Props) {
  const [active, setActive] = useState(initialActive)
  const [message, setMessage] = useState(initialMessage ?? "")
  const [activeAgainAt, setActiveAgainAt] = useState(toDatetimeLocalValue(initialActiveAgainAt))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    const res = await fetch("/qr-signer/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        active,
        message: message.trim() || null,
        // datetime-local value = local time tanpa offset; new Date() parse ini
        // sebagai local time juga, jadi konsisten.
        activeAgainAt: activeAgainAt ? new Date(activeAgainAt).toISOString() : null,
      }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || "Gagal menyimpan pengaturan")
      return
    }
    setSuccess(active ? "Mode maintenance diaktifkan." : "Mode maintenance dinonaktifkan.")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <Wrench className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Mode Maintenance Portal Peserta</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Kalau aktif, seluruh <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/peserta</code> (login,
            aktivasi, workspace) dialihkan ke halaman perbaikan sampai waktu target tercapai.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">Aktifkan mode maintenance</span>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
        />
      </label>

      <div>
        <label htmlFor="activeAgainAt" className="mb-1.5 block text-sm font-medium text-slate-800">
          Aktif kembali pada
        </label>
        <input
          id="activeAgainAt"
          type="datetime-local"
          value={activeAgainAt}
          onChange={(e) => setActiveAgainAt(e.target.value)}
          required={active}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
        />
        <p className="mt-1 text-xs text-slate-500">Ditampilkan sebagai hitung mundur di halaman perbaikan.</p>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-800">
          Pesan (opsional)
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Portal peserta sedang dalam pemeliharaan. Mohon coba lagi nanti."
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span className="leading-5">{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <span className="leading-5">{success}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {loading ? "Menyimpan..." : "Simpan Pengaturan"}
      </button>
    </form>
  )
}
