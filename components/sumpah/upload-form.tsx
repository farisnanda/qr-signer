"use client"

import { useState } from "react"

/** Tanggal hari ini sebagai YYYY-MM-DD (waktu lokal) untuk nilai default input date. */
function todayInput(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function SumpahUploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [tanggal, setTanggal] = useState(todayInput())
  const [singlePage, setSinglePage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [result, setResult] = useState<{ successCount: number; errorCount: number; total: number } | null>(null)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError("Pilih file Excel terlebih dahulu")
      return
    }
    if (!tanggal) {
      setError("Pilih tanggal terlebih dahulu")
      return
    }

    setLoading(true)
    setError("")
    setProgress(0)
    setTotal(0)
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)
    // YYYY-MM-DD -> DDMMYYYY untuk penamaan file
    formData.append("dateStr", tanggal.split("-").reverse().join(""))
    formData.append("singlePage", String(singlePage))

    try {
      const response = await fetch("/qr-signer/api/generate-sumpah", {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Terjadi kesalahan")
        setLoading(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response reader")

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6)
            try {
              const data = JSON.parse(jsonStr)
              if (data.type === "progress") {
                setProgress(data.processed)
                if (data.total) setTotal(data.total)
                if (data.error) setError(data.error)
              } else if (data.type === "complete") {
                setResult({
                  successCount: data.successCount,
                  errorCount: data.errorCount,
                  total: data.total,
                })
              } else if (data.type === "error") {
                setError(data.message)
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-3 block text-sm font-medium text-slate-700">File Excel</label>
            <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 transition hover:border-slate-400 hover:bg-slate-100">
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-sm font-medium text-slate-700">
                  {file ? file.name : "Klik untuk pilih file Excel"}
                </p>
                <p className="text-xs text-slate-500">Format: .xlsx, .xls</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tanggal <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              Dipakai untuk penamaan file: SUMPAH_PNS_
              <span className="font-mono">{tanggal ? tanggal.split("-").reverse().join("") : "DDMMYYYY"}</span>_[NIP].pdf
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              id="singlePage"
              checked={singlePage}
              onChange={(e) => setSinglePage(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            <label htmlFor="singlePage" className="flex-1 text-sm font-medium text-slate-700 cursor-pointer">
              Paksa output 1 halaman
            </label>
            <span className="text-xs text-slate-400">{singlePage ? "Hal ke-2+ dihapus" : "Semua halaman"}</span>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading && progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Progress</span>
                <span className="font-medium text-slate-900">{progress}{total ? ` / ${total}` : ""}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${total ? Math.min((progress / total) * 100, 100) : 0}%` }} />
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-lg bg-green-50 p-4">
              <p className="text-sm font-medium text-green-900">✓ Proses selesai</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-green-600 font-bold text-lg">{result.successCount}</p>
                  <p className="text-green-700">Berhasil</p>
                </div>
                <div>
                  <p className="text-red-600 font-bold text-lg">{result.errorCount}</p>
                  <p className="text-red-700">Gagal</p>
                </div>
                <div>
                  <p className="text-slate-600 font-bold text-lg">{result.total}</p>
                  <p className="text-slate-700">Total</p>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Mulai Generate"}
          </button>
        </form>
      </div>
    </div>
  )
}
