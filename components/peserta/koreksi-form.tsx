"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const FIELD_OPTIONS = [
  { value: "nama", label: "Nama (termasuk gelar)" },
  { value: "agama", label: "Agama" },
  { value: "pangkat", label: "Pangkat" },
  { value: "perangkatDaerah", label: "Perangkat Daerah" },
]

type Peserta = { nama: string; agama: string; pangkat: string; perangkatDaerah: string }

export function KoreksiForm({ peserta, hasPending }: { peserta: Peserta; hasPending: boolean }) {
  const router = useRouter()
  const [field, setField] = useState("nama")
  const [nilaiDiminta, setNilaiDiminta] = useState("")
  const [alasan, setAlasan] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const nilaiSekarang = (peserta as any)[field] as string

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nilaiDiminta.trim()) {
      setError("Isi nilai baru yang benar.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/qr-signer/api/peserta/koreksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ field, nilaiDiminta, alasan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Gagal mengajukan perbaikan")
        return
      }
      setDone(true)
      setNilaiDiminta("")
      setAlasan("")
      router.refresh()
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  if (hasPending) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
        Anda memiliki permintaan koreksi yang masih menunggu keputusan panitia. Tunggu keputusan sebelum mengajukan yang baru.
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
        <div className="text-3xl">✅</div>
        <p className="text-sm font-medium text-green-800">Permintaan perbaikan telah diajukan.</p>
        <p className="text-xs text-green-700">Anda akan menerima email setelah panitia memutuskan.</p>
        <button onClick={() => setDone(false)} type="button" className="text-xs font-medium text-green-800 underline">
          Ajukan lagi
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Jenis Perbaikan</label>
        <select
          value={field}
          onChange={(e) => {
            setField(e.target.value)
            setNilaiDiminta("")
          }}
          className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
        >
          {FIELD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm">
        <span className="text-slate-500">Data saat ini: </span>
        <span className="font-medium text-slate-800">{nilaiSekarang}</span>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nilai yang Benar</label>
        <input
          value={nilaiDiminta}
          onChange={(e) => setNilaiDiminta(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
          placeholder={field === "agama" ? "Islam / Kristen / Budha / Hindu / Katolik" : field === "pangkat" ? "mis. III/a atau Penata Muda" : "Tulis data yang benar"}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Alasan / Keterangan (opsional)</label>
        <textarea
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
          placeholder="mis. gelar tertulis salah, seharusnya S.Kom bukan S.Kes"
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

      <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
        {loading ? "Mengirim..." : "Ajukan Perbaikan"}
      </button>
    </form>
  )
}
