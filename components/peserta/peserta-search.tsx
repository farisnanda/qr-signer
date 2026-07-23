"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function PesertaSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const [q, setQ] = useState(defaultValue)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    // page selalu reset ke 1 saat pencarian baru
    router.push(`/admin/peserta${params.toString() ? "?" + params.toString() : ""}`)
  }

  function reset() {
    setQ("")
    router.push("/admin/peserta")
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari NIP, nama, atau perangkat daerah…"
        className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
      />
      <button type="submit" className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
        Cari
      </button>
      {defaultValue && (
        <button type="button" onClick={reset} className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          Reset
        </button>
      )}
    </form>
  )
}
