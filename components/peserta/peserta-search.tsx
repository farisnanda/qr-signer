"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function PesertaSearch({
  defaultValue,
  defaultStatus,
}: {
  defaultValue: string
  defaultStatus: string
}) {
  const router = useRouter()
  const [q, setQ] = useState(defaultValue)
  const [status, setStatus] = useState(defaultStatus)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status) params.set("status", status)
    router.push(`/admin/peserta${params.toString() ? "?" + params.toString() : ""}`)
  }

  function reset() {
    setQ("")
    setStatus("")
    router.push("/admin/peserta")
  }

  const exportParams = new URLSearchParams()
  if (q.trim()) exportParams.set("q", q.trim())
  if (status) exportParams.set("status", status)
  const exportHref = `/qr-signer/api/peserta/export${exportParams.toString() ? "?" + exportParams.toString() : ""}`

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto_auto]">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari NIP, nama, atau perangkat daerah..."
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-950 placeholder:text-slate-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
        >
          <option value="">Semua status</option>
          <option value="aktif">Aktif</option>
          <option value="pending">Menunggu verifikasi</option>
          <option value="belum">Belum aktivasi</option>
        </select>
        <button type="submit" className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
          Terapkan
        </button>
        <a href={exportHref} className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-green-700">
          Export
        </a>
      </div>
      {(defaultValue || defaultStatus) && (
        <div className="mt-3">
          <button type="button" onClick={reset} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Reset filter
          </button>
        </div>
      )}
    </form>
  )
}
