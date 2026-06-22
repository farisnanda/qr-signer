"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function CreateUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [role, setRole] = useState("BIDANG")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          role: formData.get("role"),
          bidang: formData.get("bidang") || null,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tambah User</h1>
        <p className="text-slate-500">Buat akun pengguna baru.</p>
      </div>

      <div className="max-w-lg rounded-2xl border bg-white p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nama</label>
            <input type="text" name="name" required className="w-full rounded-lg border px-4 py-2" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input type="email" name="email" required className="w-full rounded-lg border px-4 py-2" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input type="password" name="password" required className="w-full rounded-lg border px-4 py-2" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Role</label>
            <select
              name="role"
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
              <select name="bidang" required className="w-full rounded-lg border px-4 py-2">
                <option value="">Pilih Bidang</option>
                <option value="204.1">Sekretariat</option>
                <option value="204.2">P3DASI</option>
                <option value="204.3">PKPH</option>
                <option value="204.4">Mutasi</option>
                <option value="204.5">Pengembangan</option>
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