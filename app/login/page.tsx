"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isTimeout = searchParams.get("reason") === "timeout"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)
    setPassword("")

    if (!result) {
      setError("Terjadi kesalahan")
      return
    }

    // 2FA belum setup → wajib setup dulu
    if (result.error === "2FA_SETUP_REQUIRED") {
      sessionStorage.setItem("2fa_pending_email", email)
      router.push("/setup-2fa")
      return
    }

    // 2FA sudah aktif → verifikasi kode
    if (result.error === "2FA_REQUIRED") {
      sessionStorage.setItem("2fa_pending_email", email)
      router.push("/verify-2fa")
      return
    }

    if (result.error) {
      setError("Email atau password salah")
      return
    }

    router.push("/admin")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 -left-60 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-60 -right-60 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <img src="/logo.png" alt="Logo" className="h-9 w-9 object-contain" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">SUPER</h1>
          <p className="mt-1 text-xs text-slate-500">Badan Kepegawaian Daerah Provinsi Jawa Timur</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <div className="mb-6">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              Sistem Aktif
            </div>
            <h2 className="mt-3 text-xl font-bold text-white">Masuk ke SUPER</h2>
            <p className="mt-1 text-sm text-slate-400">Gunakan akun yang telah terdaftar di sistem</p>
          </div>

          {isTimeout && (
            <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              Sesi Anda telah berakhir karena tidak aktif. Silakan login kembali.
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <input type="text" className="hidden" aria-hidden="true" />
            <input type="password" className="hidden" aria-hidden="true" />

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">✉</span>
                <input
                  type="email"
                  placeholder="nama@bkd.jatimprov.go.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-1 focus:ring-white/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔒</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-1 focus:ring-white/10"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                ✗ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                  Memproses...
                </span>
              ) : "Masuk →"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} Badan Kepegawaian Daerah Provinsi Jawa Timur
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}