"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function VerifikasiPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Memuat…</div>}>
      <VerifikasiInner />
    </Suspense>
  )
}

function VerifikasiInner() {
  const params = useSearchParams()
  const token = params.get("token")
  const [state, setState] = useState<"loading" | "ok" | "error">("loading")
  const [message, setMessage] = useState("")
  const [nama, setNama] = useState("")

  useEffect(() => {
    if (!token) {
      setState("error")
      setMessage("Token tidak ada di tautan.")
      return
    }
    ;(async () => {
      try {
        const res = await fetch("/qr-signer/api/peserta/verifikasi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!res.ok) {
          setState("error")
          setMessage(data.error || "Verifikasi gagal.")
          return
        }
        setNama(data.nama)
        setState("ok")
      } catch {
        setState("error")
        setMessage("Terjadi kesalahan koneksi.")
      }
    })()
  }, [token])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      {state === "loading" && <p className="py-6 text-sm text-slate-500">Memverifikasi…</p>}

      {state === "ok" && (
        <>
          <div className="mb-3 text-4xl">✅</div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">Email Terverifikasi</h2>
          <p className="mb-5 text-sm text-slate-500">Akun {nama} sudah aktif. Silakan login.</p>
          <Link href="/peserta/login" className="block w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
            Masuk Sekarang
          </Link>
        </>
      )}

      {state === "error" && (
        <>
          <div className="mb-3 text-4xl">⚠️</div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">Verifikasi Gagal</h2>
          <p className="mb-5 text-sm text-slate-500">{message}</p>
          <Link href="/peserta/aktivasi" className="block w-full rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
            Aktivasi Ulang
          </Link>
        </>
      )}
    </div>
  )
}
