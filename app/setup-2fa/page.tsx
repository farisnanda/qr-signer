"use client"

import { useState, useEffect } from "react"

export default function Setup2FAPage() {
  const [email, setEmailState] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [secret, setSecret] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"loading" | "scan" | "verify">("loading")

  useEffect(() => {
    const pendingEmail = sessionStorage.getItem("2fa_pending_email")
    if (!pendingEmail) {
      window.location.href = "/login"
      return
    }
    setEmailState(pendingEmail)
    generateQR(pendingEmail)
  }, [])

  async function generateQR(email: string) {
    try {
      const res = await fetch("/api/2fa/setup-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setStep("scan")
    } catch {
      setError("Gagal memuat QR Code")
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) { setError("Kode harus 6 digit"); return }
    setLoading(true)
    setError("")

    const res = await fetch("/api/2fa/setup-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error || "Kode tidak valid"); return }

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
          <h1 className="text-2xl font-black text-white">Setup 2FA</h1>
          <p className="mt-1 text-sm text-slate-400">
            Akun Anda wajib mengaktifkan autentikasi dua faktor
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">

          {step === "loading" && (
            <div className="flex items-center justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}

          {step === "scan" && qrCode && (
            <div className="space-y-5">
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-sm font-medium text-blue-300 mb-2">📱 Langkah setup:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-blue-300/80">
                  <li>Install <span className="font-medium">Google Authenticator</span> di HP</li>
                  <li>Scan QR Code di bawah ini</li>
                  <li>Masukkan kode 6 digit untuk konfirmasi</li>
                </ol>
              </div>

              <div className="flex justify-center">
                <div className="rounded-2xl bg-white p-3">
                  <img src={qrCode} alt="QR Code 2FA" className="h-48 w-48" />
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-slate-500 mb-1">Kode manual (jika tidak bisa scan):</p>
                <p className="font-mono text-xs break-all text-slate-300 select-all">{secret}</p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  ✗ {error}
                </div>
              )}

              <button
                onClick={() => setStep("verify")}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition"
              >
                Sudah Scan → Masukkan Kode
              </button>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerify} className="space-y-4" autoComplete="off">
              <div className="text-center mb-2">
                <p className="text-sm text-slate-300">
                  Masukkan kode 6 digit dari Google Authenticator
                </p>
              </div>

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-center text-2xl font-bold tracking-widest text-white placeholder-slate-600 outline-none transition focus:border-white/20 focus:bg-white/10"
                />
                <p className="mt-1 text-center text-xs text-slate-500">Kode berlaku selama 30 detik</p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  ✗ {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep("scan"); setCode(""); setError("") }}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-400 hover:bg-white/5"
                >
                  ← Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                      Memverifikasi...
                    </span>
                  ) : "Aktivasi 2FA →"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">
          2FA wajib diaktifkan untuk keamanan akun SIGNER
        </p>
      </div>
    </div>
  )
}