"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function KeputusanButtons({ id }: { id: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<"idle" | "tolak">("idle")
  const [catatan, setCatatan] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function putuskan(keputusan: "approved" | "rejected") {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/qr-signer/api/admin/koreksi/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keputusan, catatanAdmin: catatan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Gagal memproses")
        return
      }
      router.refresh()
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  if (mode === "tolak") {
    return (
      <div className="space-y-2">
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={2}
          placeholder="Alasan penolakan (akan dikirim ke peserta)"
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setMode("idle")} type="button" className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Batal
          </button>
          <button onClick={() => putuskan("rejected")} disabled={loading} type="button" className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? "Memproses..." : "Kirim Penolakan"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => putuskan("approved")} disabled={loading} type="button" className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
          {loading ? "Memproses..." : "Setujui"}
        </button>
        <button onClick={() => setMode("tolak")} disabled={loading} type="button" className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Tolak
        </button>
      </div>
    </div>
  )
}
