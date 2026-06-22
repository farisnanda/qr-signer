"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"


export default function TwoFactorPage() {
  const { data: session, update } = useSession()
  const [qrCode, setQrCode] = useState("")
  const [secret, setSecret] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle")

  const isEnabled = (session?.user as any)?.twoFactorEnabled

  async function handleSetup() {
    setLoading(true)
    setError("")
    const res = await fetch("/api/2fa/setup")
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setQrCode(data.qrCode)
    setSecret(data.secret)
    setStep("setup")
  }

 async function handleVerifySetup(e: React.FormEvent) {
  e.preventDefault()
  setLoading(true)
  setError("")
  const res = await fetch("/api/2fa/verify-setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })
  const data = await res.json()
  setLoading(false)
  if (!res.ok) { setError(data.error); return }
  setSuccess("2FA berhasil diaktifkan! Memuat ulang...")
  setStep("idle")
  setCode("")
  setTimeout(() => window.location.reload(), 1500)
}

async function handleDisable(e: React.FormEvent) {
  e.preventDefault()
  setLoading(true)
  setError("")
  const res = await fetch("/api/2fa/disable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })
  const data = await res.json()
  setLoading(false)
  if (!res.ok) { setError(data.error); return }
  setSuccess("2FA berhasil dinonaktifkan! Memuat ulang...")
  setStep("idle")
  setCode("")
  setTimeout(() => window.location.reload(), 1500)
}

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Keamanan Akun</h1>
        <p className="text-slate-500">Kelola autentikasi dua faktor (2FA)</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Autentikasi Dua Faktor</h2>
            <p className="text-sm text-slate-500">Tambahan keamanan dengan Google Authenticator</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${isEnabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            {isEnabled ? "✓ Aktif" : "Tidak Aktif"}
          </span>
        </div>

        {success && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">✓ {success}</div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">✗ {error}</div>
        )}

        {/* IDLE STATE */}
        {step === "idle" && (
          <>
            {!isEnabled ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700 space-y-1">
                  <p className="font-medium">Cara mengaktifkan 2FA:</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-600">
                    <li>Install Google Authenticator di HP</li>
                    <li>Klik tombol di bawah untuk generate QR Code</li>
                    <li>Scan QR Code dengan Google Authenticator</li>
                    <li>Masukkan kode 6 digit untuk konfirmasi</li>
                  </ol>
                </div>
                <button
                  onClick={handleSetup}
                  disabled={loading}
                  className="w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "🔐 Aktifkan 2FA"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
                  2FA sudah aktif. Setiap login akan meminta kode dari Google Authenticator.
                </div>
                <button
                  onClick={() => setStep("disable")}
                  className="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Nonaktifkan 2FA
                </button>
              </div>
            )}
          </>
        )}

        {/* SETUP STATE */}
        {step === "setup" && qrCode && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-slate-600 mb-3">Scan QR Code ini dengan Google Authenticator:</p>
              <div className="inline-block rounded-2xl border-4 border-slate-100 p-2">
                <img src={qrCode} alt="QR Code 2FA" className="h-48 w-48" />
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">Atau masukkan kode manual:</p>
              <p className="font-mono text-xs break-all text-slate-700 select-all">{secret}</p>
            </div>

            <form onSubmit={handleVerifySetup} className="space-y-3" autoComplete="off">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Kode Verifikasi (6 digit)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border px-4 py-3 text-center text-xl font-bold tracking-widest outline-none focus:border-slate-900"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep("idle"); setCode(""); setError("") }}
                  className="flex-1 rounded-xl border py-2.5 text-sm hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? "Memverifikasi..." : "✓ Konfirmasi"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* DISABLE STATE */}
        {step === "disable" && (
          <form onSubmit={handleDisable} className="space-y-3" autoComplete="off">
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              ⚠ Masukkan kode Google Authenticator untuk menonaktifkan 2FA.
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Kode Verifikasi (6 digit)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoComplete="one-time-code"
                className="w-full rounded-xl border px-4 py-3 text-center text-xl font-bold tracking-widest outline-none focus:border-slate-900"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep("idle"); setCode(""); setError("") }}
                className="flex-1 rounded-xl border py-2.5 text-sm hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Nonaktifkan"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}