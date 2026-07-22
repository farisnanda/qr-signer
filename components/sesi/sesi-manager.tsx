"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Sesi = {
  id: string
  nama: string
  pin: string
  aktif: boolean
  hadir: number
  createdAt: string
}

export function SesiManager({ initial }: { initial: Sesi[] }) {
  const router = useRouter()
  const [nama, setNama] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function createSesi(e: React.FormEvent) {
    e.preventDefault()
    if (!nama.trim()) {
      setError("Nama sesi wajib diisi")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/qr-signer/api/sesi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nama }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Gagal membuat sesi")
        return
      }
      setNama("")
      router.refresh()
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  async function toggle(id: string, aktif: boolean) {
    await fetch("/qr-signer/api/sesi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, aktif }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={createSesi} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama Sesi</label>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
              placeholder="mis. Pengambilan Sumpah CPNS 22 Juli 2026"
            />
          </div>
          <button type="submit" disabled={loading} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Membuat..." : "Buat Sesi"}
          </button>
        </form>
        {error && <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nama Sesi</th>
              <th className="px-4 py-3 font-medium">PIN</th>
              <th className="px-4 py-3 font-medium">Hadir</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initial.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada sesi.</td>
              </tr>
            ) : (
              initial.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{s.nama}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-slate-100 px-3 py-1 font-mono text-base font-bold tracking-widest text-slate-800">{s.pin}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.hadir}</td>
                  <td className="px-4 py-3">
                    {s.aktif ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aktif</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Nonaktif</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(s.id, !s.aktif)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      {s.aktif ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
