"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Memuat…</div>}>
      <ResetInner />
    </Suspense>
  )
}

function ResetInner() {
  const token = useSearchParams().get("token")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      setError("Token tidak ada di tautan.")
      return
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/qr-signer/api/peserta/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Gagal reset password")
        return
      }
      setDone(true)
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mb-3 text-4xl">✅</div>
        <h2 className="mb-1 text-lg font-bold text-slate-900">Password Diperbarui</h2>
        <p className="mb-5 text-sm text-slate-500">Silakan login dengan password baru Anda.</p>
        <Link href="/peserta/login" className="block w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
          Masuk Sekarang
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Password Baru</h2>
      <p className="mb-5 text-sm text-slate-500">Buat password baru untuk akun Anda.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password Baru</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
            placeholder="Minimal 6 karakter"
            minLength={6}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Konfirmasi Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
            placeholder="Ulangi password"
            minLength={6}
            required
          />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Memproses..." : "Simpan Password"}
        </button>
      </form>
    </div>
  )
}
