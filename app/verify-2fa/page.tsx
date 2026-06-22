"use client"

import { useState, useEffect, Suspense } from "react"

function VerifyForm() {
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const pendingEmail = sessionStorage.getItem("2fa_pending_email")
    if (!pendingEmail) {
      window.location.href = "/login"
      return
    }
    setEmail(pendingEmail)
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError("Session tidak valid, silakan login ulang"); return }
    if (code.length !== 6) { setError("Kode harus 6 digit"); return }
    setLoading(true)
    setError("")

    const res = await fetch("/api/2fa/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    })

    const result = await res.json()
    setLoading(false)

    if (!res.ok) { setError(result.error || "Kode tidak valid"); return }

    sessionStorage.removeItem("2fa_pending_email")
    window.location.href = "/admin"
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
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-2xl font-black text-white">Verifikasi 2FA</h1>
          <p className="mt-1 text-sm text-slate-400">Masukkan kode dari Google Authenticator</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <form onSubmit={handleVerify} className="space-y-4" autoComplete="off">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Kode Verifikasi</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoComplete="one-time-code"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-center text-2xl font-bold tracking-widest text-white placeholder-slate-600 outline-none transition focus:border-white/20 focus:bg-white/10"
              />
              <p className="mt-1 text-center text-xs text-slate-500">Kode berlaku selama 30 detik</p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                ✗ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                  Memverifikasi...
                </span>
              ) : "Verifikasi →"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">
          Buka Google Authenticator dan masukkan kode untuk SIGNER BKD Jawa Timur
        </p>
      </div>
    </div>
  )
}

export default function VerifyTwoFactorPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  )
}