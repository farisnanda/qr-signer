"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Result = {
  total: number
  created: number
  updated: number
  errorCount: number
  errors: Array<{ baris: number; nip: string; pesan: string }>
}

export function PesertaImportForm() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError("Pilih file Excel terlebih dahulu")
      return
    }
    setLoading(true)
    setError("")
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/qr-signer/api/peserta/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan")
        return
      }
      setResult(data)
      setFile(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">File Excel Peserta</label>
          <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition hover:border-slate-400 hover:bg-slate-100">
            <div className="text-center">
              <div className="mb-1 text-2xl">📋</div>
              <p className="text-sm font-medium text-slate-700">{file ? file.name : "Klik untuk pilih file Excel"}</p>
              <p className="text-xs text-slate-500">Kolom: NIP, Nama, Pangkat, Perangkat Daerah, Agama</p>
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        {result && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-900">Import selesai</p>
            <div className="flex gap-4 text-xs">
              <span className="text-green-700">+{result.created} baru</span>
              <span className="text-blue-700">{result.updated} diperbarui</span>
              <span className="text-red-700">{result.errorCount} gagal</span>
              <span className="text-slate-500">dari {result.total} baris</span>
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-600">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Baris {e.baris} {e.nip ? `(${e.nip})` : ""}: {e.pesan}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Mengimport..." : "Import Peserta"}
        </button>
      </form>
    </div>
  )
}
