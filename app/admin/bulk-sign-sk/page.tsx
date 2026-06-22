"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

const PdfViewer = dynamic(() => import("@/components/documents/pdf-viewer"), { ssr: false })

const JENIS_SK_OPTIONS = [
  { value: "SK_PNS", label: "SK PNS — Pengangkatan CPNS menjadi PNS" },
  { value: "SK_JABATAN", label: "SK Jabatan" },
  { value: "SUMPAH_PNS", label: "Sumpah PNS" },
]

export default function BulkSignSkPage() {
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [jenisSk, setJenisSk] = useState("SK_PNS")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [progress, setProgress] = useState("")
  const [progressPercent, setProgressPercent] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [processedRows, setProcessedRows] = useState(0)
  const [useQr, setUseQr] = useState(true)
  const [singlePage, setSinglePage] = useState(true)

  // 2FA modal
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [twoFactorError, setTwoFactorError] = useState("")
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)

  // QR placement
  const [showQrModal, setShowQrModal] = useState(false)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [qrPosition, setQrPosition] = useState({ x: 50, y: 50, width: 100, height: 100 })
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfScale, setPdfScale] = useState(1)
  const [canvasHeight, setCanvasHeight] = useState(800)
  const [qrConfirmed, setQrConfirmed] = useState(false)

  async function handleClickMulai() {
    if (!excelFile || !templateFile) {
      setError("File Excel dan template DOCX wajib diupload")
      return
    }
    // Cek apakah user punya 2FA aktif
    const sessionRes = await fetch("/api/auth/session")
    const sessionData = await sessionRes.json()
    const hasTwoFactor = sessionData?.user?.twoFactorEnabled

    if (hasTwoFactor) {
      setShowTwoFactorModal(true)
    } else {
      handleSubmit()
    }
  }

  async function handleTwoFactorVerify() {
    if (twoFactorCode.length !== 6) {
      setTwoFactorError("Kode harus 6 digit")
      return
    }
    setTwoFactorLoading(true)
    setTwoFactorError("")

    const res = await fetch("/api/2fa/validate-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: twoFactorCode }),
    })

    const result = await res.json()
    setTwoFactorLoading(false)

    if (!res.ok) {
      setTwoFactorError(result.error || "Kode tidak valid")
      return
    }

    setShowTwoFactorModal(false)
    setTwoFactorCode("")
    setTwoFactorError("")
    handleSubmit()
  }

  async function handleSubmit() {
    if (!excelFile || !templateFile) {
      setError("File Excel dan template DOCX wajib diupload")
      return
    }
    setLoading(true)
    setError("")
    setResults([])
    setSummary(null)
    setProgressPercent(0)
    setProcessedRows(0)
    setTotalRows(0)
    setProgress("Menghubungkan ke server...")

    try {
      const formData = new FormData()
      formData.append("excel", excelFile)
      formData.append("template", templateFile)
      formData.append("jenisSk", jenisSk)
      formData.append("useQr", String(useQr))
      formData.append("singlePage", String(singlePage))
      formData.append("qrX", String(qrPosition.x))
      formData.append("qrY", String(qrPosition.y))
      formData.append("qrWidth", String(qrPosition.width))
      formData.append("qrHeight", String(qrPosition.height))
      formData.append("pageNumber", String(currentPage))
      formData.append("pdfScale", String(pdfScale))
      formData.append("canvasHeight", String(canvasHeight))

      const res = await fetch("/api/bulk-sign-sk", {
        method: "POST",
        body: formData,
      })

      if (!res.ok || !res.body) {
        const err = await res.json()
        setError(err.error || "Terjadi kesalahan")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === "start") {
              setTotalRows(data.total)
              setProgress("Generating PDF...")
            }

            if (data.type === "progress") {
              setProcessedRows(data.processed)
              setProgressPercent((data.processed / data.total) * 100)
              setResults(prev => [...prev, {
                nip: data.nip,
                nama: data.nama,
                status: data.status,
                fileName: data.fileName,
                error: data.error,
              }])
            }

            if (data.type === "done") {
              setProgressPercent(100)
              setProcessedRows(data.total)
              setSummary({
                total: data.total,
                successCount: data.successCount,
                errorCount: data.errorCount,
                downloadUrl: data.downloadUrl,
                reportUrl: data.reportUrl,
              })
              setProgress("")
            }

            if (data.type === "error") {
              setError(data.error || "Terjadi kesalahan")
            }
          } catch {}
        }
      }
    } catch {
      setError("Terjadi kesalahan koneksi")
    } finally {
      setLoading(false)
      setProgress("")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Sign SK</h1>
        <p className="text-slate-500">Generate SK massal dari Excel dan download sebagai ZIP</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* FORM */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-6 space-y-4">
            <h2 className="font-bold text-slate-800">Konfigurasi</h2>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            {/* Jenis SK */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Jenis SK</label>
              <select
                value={jenisSk}
                onChange={(e) => setJenisSk(e.target.value)}
                className="w-full rounded-lg border px-4 py-2 text-sm"
              >
                {JENIS_SK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Upload Excel */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                File Data Excel (.xlsx) <span className="text-red-500">*</span>
              </label>
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center">
                {excelFile ? (
                  <div>
                    <p className="text-sm font-medium text-green-700">✓ {excelFile.name}</p>
                    <p className="text-xs text-slate-400">{(excelFile.size / 1024).toFixed(0)} KB</p>
                    <button type="button" onClick={() => setExcelFile(null)} className="mt-1 text-xs text-red-500">Hapus</button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <p className="text-sm text-slate-500">📊 Klik untuk pilih file Excel</p>
                    <p className="text-xs text-slate-400">Format: .xlsx</p>
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </div>

            {/* Upload Template */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Template DOCX <span className="text-red-500">*</span>
              </label>
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center">
                {templateFile ? (
                  <div>
                    <p className="text-sm font-medium text-green-700">✓ {templateFile.name}</p>
                    <p className="text-xs text-slate-400">{(templateFile.size / 1024).toFixed(0)} KB</p>
                    <button type="button" onClick={() => { setTemplateFile(null); setQrConfirmed(false) }} className="mt-1 text-xs text-red-500">Hapus</button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <p className="text-sm text-slate-500">📄 Klik untuk pilih template DOCX</p>
                    <p className="text-xs text-slate-400">Gunakan SK_PNS_FIX_READY.docx</p>
                    <input type="file" accept=".docx" className="hidden" onChange={(e) => setTemplateFile(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </div>

            {/* OPTIONS */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Opsi Output</p>

              {/* Toggle QR */}
              <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  id="useQr"
                  checked={useQr}
                  onChange={(e) => {
                    setUseQr(e.target.checked)
                    if (!e.target.checked) setQrConfirmed(false)
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                <label htmlFor="useQr" className="flex-1 text-sm font-medium text-slate-700 cursor-pointer">
                  Sertakan QR Code verifikasi
                </label>
                {useQr && qrConfirmed && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">✓ Dikonfirmasi</span>
                )}
                {useQr && !qrConfirmed && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-600">Belum diatur</span>
                )}
              </div>

              {/* Toggle Single Page */}
              <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  id="singlePage"
                  checked={singlePage}
                  onChange={(e) => setSinglePage(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                <label htmlFor="singlePage" className="flex-1 text-sm font-medium text-slate-700 cursor-pointer">
                  Paksa output 1 halaman
                </label>
                <span className="text-xs text-slate-400">
                  {singlePage ? "Hal ke-2+ dihapus" : "Semua halaman"}
                </span>
              </div>
            </div>

            {/* QR Position */}
            {useQr && (
              <div className="rounded-xl border bg-slate-50 p-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">Posisi QR Code</p>
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                  <div>X: <span className="font-medium text-slate-800">{Math.round(qrPosition.x)}</span></div>
                  <div>Y: <span className="font-medium text-slate-800">{Math.round(qrPosition.y)}</span></div>
                  <div>W: <span className="font-medium text-slate-800">{Math.round(qrPosition.width)}</span></div>
                  <div>H: <span className="font-medium text-slate-800">{Math.round(qrPosition.height)}</span></div>
                </div>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="w-full rounded-xl border py-2 text-sm hover:bg-white transition"
                >
                  🎯 Atur Posisi QR Code
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleClickMulai}
              disabled={loading || !excelFile || !templateFile}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {totalRows > 0
                    ? `${processedRows} / ${totalRows} dokumen`
                    : (progress || "Memproses...")}
                </span>
              ) : "🚀 Mulai Generate SK"}
            </button>

            {/* PROGRESS BAR */}
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {totalRows > 0
                      ? `${processedRows} / ${totalRows} dokumen`
                      : (progress || "Memproses...")}
                  </span>
                  <span className="font-medium">{Math.round(Math.min(progressPercent, 100))}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(progressPercent, 100)}%`,
                      background: progressPercent >= 100
                        ? "#16a34a"
                        : "linear-gradient(90deg, #1e3a5f, #2563eb)",
                    }}
                  />
                </div>
                <p className="text-center text-xs text-slate-400">
                  Proses ini mungkin memakan waktu beberapa menit
                </p>
              </div>
            )}
          </div>

          {/* INFO PLACEHOLDER */}
          <div className="rounded-2xl border bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-700 mb-2">📋 Placeholder Template</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-blue-600">
              {[
                "{nomor_sk}", "{nama}", "{nip}", "{tempat_lahir}",
                "{tanggal_lahir}", "{jenis_kelamin}", "{jenjang}", "{prodi}",
                "{tahun_lulus}", "{golongan}", "{gaji_cpns}", "{jabatan}",
                "{masa_kerja}", "{unor}", "{gaji_pns}", "{golongan_ruang}",
                "{nomor_surat_dokter}", "{tanggal_surat_dokter}",
                "{nomor_surat_latsar}", "{tanggal_surat_latsar}",
              ].map((p) => (
                <span key={p} className="font-mono">{p}</span>
              ))}
            </div>
          </div>
        </div>

        {/* HASIL */}
        <div className="space-y-4">
          {summary && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border bg-slate-50 p-4 text-center">
                  <p className="text-2xl font-bold">{summary.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div className="rounded-2xl border bg-green-50 p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{summary.successCount}</p>
                  <p className="text-xs text-green-600">Berhasil</p>
                </div>
                <div className="rounded-2xl border bg-red-50 p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{summary.errorCount}</p>
                  <p className="text-xs text-red-600">Gagal</p>
                </div>
              </div>

              {summary.downloadUrl && (
                <a href={summary.downloadUrl} download
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-700 transition"
                >
                  ⬇ Download Semua SK ({summary.successCount} file .zip)
                </a>
              )}

              {summary.reportUrl && (
                <a href={summary.reportUrl} download
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  📊 Download Laporan Excel ({summary.total} data)
                </a>
              )}

              {summary.errorCount > 0 && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  ⚠ {summary.errorCount} dokumen gagal diproses. Lihat detail di laporan Excel atau list di bawah.
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="border-b px-4 py-3 flex items-center justify-between">
                <h2 className="font-bold text-sm">Hasil Proses</h2>
                <div className="flex items-center gap-2">
                  {loading && (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                      Live
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{results.length} / {totalRows || results.length} data</span>
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto divide-y">
                {results.map((r, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.nama}</p>
                      <p className="text-xs text-slate-400 font-mono">{r.nip}</p>
                      {r.error && <p className="text-xs text-red-500 mt-0.5">{r.error}</p>}
                    </div>
                    <div className="shrink-0">
                      {r.status === "success" ? (
                        <span className="rounded-lg bg-green-100 px-3 py-1 text-xs font-medium text-green-700">✓ Selesai</span>
                      ) : (
                        <span className="rounded-lg bg-red-100 px-3 py-1 text-xs text-red-700">Gagal</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!summary && !loading && results.length === 0 && (
            <div className="rounded-2xl border bg-white p-12 text-center">
              <p className="text-5xl mb-4">📋</p>
              <p className="font-medium text-slate-700 mb-1">Siap Generate SK Massal</p>
              <p className="text-sm text-slate-400">Upload Excel + Template DOCX lalu klik Mulai</p>
            </div>
          )}

          {loading && results.length === 0 && (
            <div className="rounded-2xl border bg-white p-10 text-center">
              <div className="flex justify-center mb-5">
                <div className="relative h-20 w-20">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                    <circle cx="32" cy="32" r="28" fill="none"
                      stroke={progressPercent >= 100 ? "#16a34a" : "#1e3a5f"}
                      strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.min(progressPercent, 100) / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-700">
                    {Math.round(Math.min(progressPercent, 100))}%
                  </span>
                </div>
              </div>
              <p className="font-medium text-slate-700 mb-1">Mempersiapkan...</p>
              <p className="text-sm text-slate-400">{progress}</p>
            </div>
          )}

          {loading && results.length > 0 && totalRows > 0 && (
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 shrink-0">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                    <circle cx="32" cy="32" r="28" fill="none"
                      stroke={progressPercent >= 100 ? "#16a34a" : "#1e3a5f"}
                      strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.min(progressPercent, 100) / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
                    {Math.round(Math.min(progressPercent, 100))}%
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    {processedRows} <span className="text-slate-400 font-normal">/ {totalRows} dokumen</span>
                  </p>
                  <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(progressPercent, 100)}%`,
                        background: progressPercent >= 100 ? "#16a34a" : "linear-gradient(90deg, #1e3a5f, #2563eb)",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Sedang memproses dokumen...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 2FA */}
      {showTwoFactorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <span className="text-xl">🔐</span>
              </div>
              <h2 className="font-bold text-slate-800">Verifikasi 2FA</h2>
              <p className="text-sm text-slate-500 mt-1">Masukkan kode Google Authenticator untuk melanjutkan proses</p>
            </div>

            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                autoComplete="one-time-code"
                autoFocus
                className="w-full rounded-xl border px-4 py-3 text-center text-2xl font-bold tracking-widest outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
              <p className="mt-1 text-center text-xs text-slate-400">Kode berlaku selama 30 detik</p>
            </div>

            {twoFactorError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">✗ {twoFactorError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowTwoFactorModal(false)
                  setTwoFactorCode("")
                  setTwoFactorError("")
                }}
                className="flex-1 rounded-xl border py-2.5 text-sm hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleTwoFactorVerify}
                disabled={twoFactorLoading || twoFactorCode.length !== 6}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {twoFactorLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Memverifikasi...
                  </span>
                ) : "Konfirmasi →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QR PLACEMENT */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5 shrink-0">
              <div>
                <h2 className="font-bold">Atur Posisi QR Code</h2>
                <p className="text-xs text-slate-500">Upload PDF sample untuk menentukan posisi QR</p>
              </div>
              <button onClick={() => setShowQrModal(false)} className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-100">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {!previewFile ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
                  <p className="text-2xl mb-3">📄</p>
                  <p className="text-sm text-slate-600 mb-1 font-medium">Upload PDF sample</p>
                  <p className="text-xs text-slate-400 mb-4">Upload salah satu PDF SK untuk menentukan posisi QR Code</p>
                  <label className="cursor-pointer rounded-xl bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-800">
                    Pilih PDF
                    <input type="file" accept=".pdf" className="hidden" onChange={(e) => setPreviewFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className="flex-1 overflow-auto">
                    <PdfViewer
                      file={previewFile}
                      qrPosition={qrPosition}
                      setQrPosition={setQrPosition}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      onScaleChange={setPdfScale}
                      onCanvasHeightChange={setCanvasHeight}
                    />
                  </div>
                  <div className="w-40 space-y-2 text-sm shrink-0">
                    <div className="rounded-xl border bg-slate-50 p-3 space-y-1">
                      <p className="font-medium text-slate-700 text-xs">Info QR</p>
                      <p className="text-xs text-slate-500">Hal: <span className="font-medium">{currentPage}</span></p>
                      <p className="text-xs text-slate-500">X: <span className="font-medium">{Math.round(qrPosition.x)}</span></p>
                      <p className="text-xs text-slate-500">Y: <span className="font-medium">{Math.round(qrPosition.y)}</span></p>
                      <p className="text-xs text-slate-500">W: <span className="font-medium">{Math.round(qrPosition.width)}</span></p>
                      <p className="text-xs text-slate-500">H: <span className="font-medium">{Math.round(qrPosition.height)}</span></p>
                    </div>
                    <button onClick={() => setPreviewFile(null)} className="w-full rounded-xl border py-2 text-xs hover:bg-slate-100">Ganti PDF</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t p-5 shrink-0">
              <button onClick={() => setShowQrModal(false)} className="rounded-xl border px-5 py-2 text-sm hover:bg-slate-100">Batal</button>
              <button
                onClick={() => { setQrConfirmed(true); setShowQrModal(false) }}
                className="rounded-xl bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-700"
              >
                ✓ Konfirmasi Posisi QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}