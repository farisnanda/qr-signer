"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"

const BIDANG_LABELS: Record<string, string> = {
  "204.1": "Sekretariat",
  "204.2": "P3DASI",
  "204.3": "PKPH",
  "204.4": "Mutasi",
  "204.5": "Pengembangan",
  "204.6": "UPT",
}

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("BIDANG")
  const [bidang, setBidang] = useState("")

  useEffect(() => {
    fetch("/api/users/" + userId)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name || "")
        setEmail(data.email || "")
        setRole(data.role || "BIDANG")
        setBidang(data.bidang || "")
        setFetching(false)
      })
  }, [userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/users/" + userId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password: password || undefined,
          role,
          bidang: role === "BIDANG" ? bidang : null,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || "Terjadi kesalahan")
        return
      }

      router.push("/admin/users")
    } catch (err) {
      setError("Terjadi kesalahan, coba lagi")
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Memuat data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit User</h1>
        <p className="text-slate-500">Ubah data akun pengguna.</p>
      </div>

      <div className="max-w-lg rounded-2xl border bg-white p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nama</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Password
              <span className="ml-1 text-xs text-slate-400">(kosongkan jika tidak ingin diubah)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2"
            >
              <option value="BIDANG">Bidang</option>
              <option value="KABAN">Kaban</option>
              <option value="SUPERADMIN">Super Admin</option>
            </select>
          </div>

          {role === "BIDANG" && (
            <div>
              <label className="mb-1 block text-sm font-medium">Bidang</label>
              <select
                value={bidang}
                onChange={(e) => setBidang(e.target.value)}
                required
                className="w-full rounded-lg border px-4 py-2"
              >
                <option value="">Pilih Bidang</option>
                {Object.entries(BIDANG_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full rounded-xl border py-3 text-sm hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black py-3 text-white disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}