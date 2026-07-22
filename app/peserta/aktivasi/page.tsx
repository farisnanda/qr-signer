"use client"

import { useState } from "react"
import Link from "next/link"

export default function AktivasiPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [nip, setNip] = useState("")
  const [nama, setNama] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ message: string; devLink?: string } | null>(null)

  async function cekNip(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/qr-signer/api/peserta/cek-nip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nip }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(res.status === 404 ? "NIP tidak terdaftar sebagai peserta." : data.error || "Gagal")
        return
      }
      if (data.status === "aktif") {
        setError("Akun sudah aktif. Silakan login.")
        return
      }
      setNama(data.nama)
      setStep(2)
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  async function aktivasi(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/qr-signer/api/peserta/aktivasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nip, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Gagal aktivasi")
        return
      }
      setDone({ message: data.message, devLink: data.devLink })
      setStep(3)
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {step === 1 && (
        <>
          <h2 className="mb-1 text-lg font-bold text-slate-900">Aktivasi Akun</h2>
          <p className="mb-5 text-sm text-slate-500">Masukkan NIP Anda untuk memulai.</p>
          <form onSubmit={cekNip} className="space-y-4">
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
              {loading ? "Mengecek..." : "Lanjut"}
            </button>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="mb-1 text-lg font-bold text-slate-900">Halo, {nama}</h2>
          <p className="mb-5 text-sm text-slate-500">Buat email & password. Link verifikasi dikirim ke email ini.</p>
          <form onSubmit={aktivasi} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
                placeholder="email@contoh.com"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
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
            {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Memproses..." : "Aktivasi & Kirim Verifikasi"}
            </button>
          </form>
        </>
      )}

      {step === 3 && done && (
        <>
          <div className="mb-3 text-center text-4xl">📧</div>
          <h2 className="mb-1 text-center text-lg font-bold text-slate-900">Cek Email Anda</h2>
          <p className="mb-4 text-center text-sm text-slate-500">{done.message}</p>
          {done.devLink && (
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <p className="mb-1 font-medium">Mode dev (SMTP belum diset) — link verifikasi:</p>
              <a href={done.devLink} className="break-all font-mono text-amber-800 underline">{done.devLink}</a>
            </div>
          )}
          <Link href="/peserta/login" className="block w-full rounded-xl bg-slate-100 py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-200">
            Ke halaman login
          </Link>
        </>
      )}

      <div className="mt-5 text-center text-xs">
        <Link href="/peserta/login" className="text-slate-500 hover:underline">Sudah punya akun? Login</Link>
      </div>
    </div>
  )
}
