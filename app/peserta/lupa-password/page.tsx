"use client"

import { useState } from "react"
import Link from "next/link"

export default function LupaPasswordPage() {
  const [nip, setNip] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ message: string; devLink?: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/qr-signer/api/peserta/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nip }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Gagal")
        return
      }
      setDone({ message: data.message, devLink: data.devLink })
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mb-3 text-4xl">📧</div>
        <h2 className="mb-1 text-lg font-bold text-slate-900">Cek Email Anda</h2>
        <p className="mb-4 text-sm text-slate-500">{done.message}</p>
        {done.devLink && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-700">
            <p className="mb-1 font-medium">Mode dev — link reset:</p>
            <a href={done.devLink} className="break-all font-mono text-amber-800 underline">{done.devLink}</a>
          </div>
        )}
        <Link href="/peserta/login" className="block w-full rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
          Kembali ke login
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Lupa Password</h2>
      <p className="mb-5 text-sm text-slate-500">Masukkan NIP. Link reset dikirim ke email terdaftar.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">NIP</label>
          <input
            value={nip}
            onChange={(e) => setNip(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
            placeholder="Masukkan NIP"
            required
          />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Memproses..." : "Kirim Link Reset"}
        </button>
      </form>
      <div className="mt-5 text-center text-xs">
        <Link href="/peserta/login" className="text-slate-500 hover:underline">Kembali ke login</Link>
      </div>
    </div>
  )
}
