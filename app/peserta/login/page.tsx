"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function PesertaLoginPage() {
  const router = useRouter()
  const [nip, setNip] = useState("")
  const [password, setPassword] = useState("")
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Masuk</h2>
      <p className="mb-5 text-sm text-slate-500">Login dengan NIP dan password Anda.</p>

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
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
            placeholder="Masukkan password"
            required
          />
        </div>

        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs">
        <Link href="/peserta/aktivasi" className="font-medium text-blue-600 hover:underline">
          Aktivasi akun (pertama kali)
        </Link>
        <Link href="/peserta/lupa-password" className="text-slate-500 hover:underline">
          Lupa password?
        </Link>
      </div>
    </div>
  )
}
