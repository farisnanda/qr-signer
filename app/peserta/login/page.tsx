"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  UserPlus,
} from "lucide-react"

export default function PesertaLoginPage() {
  const router = useRouter()
  const [nip, setNip] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await signIn("peserta", { nip, password, redirect: false })

    if (res?.error) {
      if (res.error === "BELUM_VERIFIKASI") {
        setError("Email belum diverifikasi. Cek email Anda atau aktivasi ulang.")
      } else {
        setError("NIP atau password salah.")
      }
      setLoading(false)
      return
    }

    router.push("/peserta")
    router.refresh()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/50">
      <div className="border-b border-blue-200 bg-gradient-to-br from-blue-700 via-cyan-700 to-teal-700 px-5 py-5 text-white sm:px-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold text-white">
          <ShieldCheck className="h-3.5 w-3.5" />
          Akses peserta terverifikasi
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">Portal Peserta</h2>
        <p className="mt-1 text-sm font-medium leading-6 text-slate-200">
          Aktivasi akun terlebih dahulu jika ini pertama kali Anda menggunakan layanan.
        </p>
      </div>

      <div className="border-b border-blue-100 bg-blue-50 px-5 py-5 sm:px-6">
        <Link
          href="/peserta/aktivasi"
          className="flex min-h-14 items-center justify-center gap-3 rounded-xl bg-blue-700 px-4 py-3 text-base font-black text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"
        >
          <UserPlus className="h-5 w-5" />
          Aktivasi Akun Pertama Kali
        </Link>
        <p className="mt-3 text-center text-sm font-semibold leading-5 text-blue-950">
          Gunakan tombol ini untuk membuat akses peserta sebelum login.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">Sudah aktif?</p>
          <p className="text-xs font-medium text-slate-600">Masuk dengan NIP dan password Anda.</p>
        </div>

        <div>
          <label htmlFor="nip" className="mb-1.5 block text-sm font-medium text-slate-800">
            NIP
          </label>
          <div className="relative">
            <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="nip"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              placeholder="Masukkan NIP"
              inputMode="numeric"
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-800">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-12 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              placeholder="Masukkan password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <span className="leading-5">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-500"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
        <Link
          href="/peserta/lupa-password"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-white"
        >
          <KeyRound className="h-4 w-4 text-slate-700" />
          Lupa Password
        </Link>
      </div>
    </div>
  )
}
