"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import JSZip from "jszip"
import { saveAs } from "file-saver"
import { v4 as uuidv4 } from "uuid"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const PdfViewer = dynamic(
  () => import("@/components/documents/pdf-viewer"),
  { ssr: false }
)

export function BulkUploadForm() {
  const [files, setFiles] = useState<File[]>([])
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [qrPosition, setQrPosition] = useState({ x: 50, y: 50, width: 120, height: 120 })
  const [pdfScale, setPdfScale] = useState(1)
  const [canvasHeight, setCanvasHeight] = useState(800)

  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState("")
  const [successCount, setSuccessCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [errorFiles, setErrorFiles] = useState<string[]>([])
  const [results, setResults] = useState<any[]>([])

  // 2FA modal
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [twoFactorError, setTwoFactorError] = useState("")
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(selectedFiles)
    if (selectedFiles[0]) setPreviewFile(selectedFiles[0])
    setCurrentPage(1)
    setQrPosition({ x: 50, y: 50, width: 120, height: 120 })
    setProgress(0)
    setProgressText("")
    setSuccessCount(0)
    setErrorCount(0)
    setErrorFiles([])
    setResults([])
  }

  async function handleClickProcess() {
    if (files.length === 0) {
      alert("Pilih file PDF")
      return
    }

    // Cek apakah user punya 2FA aktif
    const sessionRes = await fetch("/api/auth/session")
    const sessionData = await sessionRes.json()
    const hasTwoFactor = sessionData?.user?.twoFactorEnabled

    if (hasTwoFactor) {
      setShowTwoFactorModal(true)
    } else {
      handleUpload()
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
    handleUpload()
  }

  async function handleUpload() {
    const batchCode = uuidv4().slice(0, 8).toUpperCase()

    setLoading(true)
    setProgress(0)
    setSuccessCount(0)
    setErrorCount(0)
    setErrorFiles([])
    setResults([])

    const allResults: any[] = []
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      setProgressText(`Memproses ${i + 1} / ${files.length}: ${file.name}`)
      setProgress(Math.round((i / files.length) * 100))

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("pageNumber", currentPage.toString())
        formData.append("qrX", qrPosition.x.toString())
        formData.append("qrY", qrPosition.y.toString())
        formData.append("qrWidth", qrPosition.width.toString())
        formData.append("qrHeight", qrPosition.height.toString())
        formData.append("pdfScale", pdfScale.toString())
        formData.append("canvasHeight", canvasHeight.toString())
        formData.append("batchCode", batchCode)
        formData.append("batchTotal", files.length.toString())
        formData.append("batchIndex", i.toString())

        const response = await fetch("/api/bulk-sign", {
          method: "POST",
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          errors.push(file.name)
          setErrorCount((prev) => prev + 1)
        } else {
          allResults.push(result.result)
          setSuccessCount((prev) => prev + 1)
        }
      } catch (err) {
        errors.push(file.name)
        setErrorCount((prev) => prev + 1)
      }
    }

    setProgress(100)
    setProgressText("Selesai! Menyiapkan ZIP...")
    setResults(allResults)
    setErrorFiles(errors)

    if (allResults.length > 0) {
      const zip = new JSZip()
      await Promise.all(
        allResults.map(async (item: any) => {
          try {
            const fileResponse = await fetch(window.location.origin + item.filePath)
            const blob = await fileResponse.blob()
            zip.file(`${item.title}_verified.pdf`, blob)
          } catch (err) {
            console.log("ZIP ERROR:", err)
          }
        })
      )
      const zipBlob = await zip.generateAsync({ type: "blob" })
      saveAs(zipBlob, `bulk-signed-${batchCode}.zip`)
    }

    setProgressText("Selesai!")
    setLoading(false)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* LEFT */}
      <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold">Bulk Upload PDF</h2>
          <p className="text-sm text-slate-500">Upload banyak PDF sekaligus dan tambahkan QR verifikasi otomatis.</p>
        </div>

        <div className="space-y-2">
          <Label>File PDF</Label>
          <Input type="file" accept=".pdf" multiple onChange={handleFileChange} />
        </div>

        {files.length > 0 && (
          <div className="space-y-2 rounded-xl border bg-slate-50 p-3">
            <div className="text-sm font-semibold">
              Total File: <span className="text-blue-600">{files.length}</span>
            </div>
            <div className="max-h-40 space-y-1 overflow-auto">
              {files.map((file, index) => (
                <div key={index} className="rounded-lg border bg-white p-2 text-sm">
                  {file.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          <div>Halaman aktif: <span className="font-bold">{currentPage}</span></div>
          <div>Posisi QR: x={Math.round(qrPosition.x)}, y={Math.round(qrPosition.y)}</div>
          <div>Ukuran QR: {Math.round(qrPosition.width)}x{Math.round(qrPosition.height)}px</div>
        </div>

        {/* PROGRESS */}
        {loading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{progressText}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-black transition-all duration-300"
                style={{ width: progress + "%" }}
              />
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">✓ Berhasil: {successCount}</span>
              {errorCount > 0 && <span className="text-red-600">✗ Gagal: {errorCount}</span>}
            </div>
          </div>
        )}

        {/* HASIL SETELAH SELESAI */}
        {!loading && progress === 100 && (
          <div className="space-y-2 rounded-xl border p-3">
            <div className="text-sm font-semibold">Hasil Proses:</div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">✓ Berhasil: {successCount}</span>
              {errorCount > 0 && <span className="text-red-600">✗ Gagal: {errorCount}</span>}
            </div>
            {errorFiles.length > 0 && (
              <div className="max-h-32 overflow-auto">
                <div className="mb-1 text-xs text-red-500">File yang gagal:</div>
                {errorFiles.map((name, i) => (
                  <div key={i} className="text-xs text-red-400">{name}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleClickProcess}
          disabled={loading || files.length === 0}
          className="w-full"
        >
          {loading
            ? `Processing... (${successCount + errorCount}/${files.length})`
            : "Process Bulk Sign"}
        </Button>
      </div>

      {/* RIGHT */}
      <div className="overflow-auto rounded-xl border bg-gray-100 p-4">
        {previewFile ? (
          <PdfViewer
            file={previewFile}
            qrValue="QR-SURAT"
            qrPosition={qrPosition}
            setQrPosition={setQrPosition}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            onScaleChange={(scale) => setPdfScale(scale)}
            onCanvasHeightChange={(h) => setCanvasHeight(h)}
          />
        ) : (
          <div className="flex h-[700px] items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-400">
            Preview PDF akan muncul di sini
          </div>
        )}
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
              <p className="text-sm text-slate-500 mt-1">
                Masukkan kode Google Authenticator untuk melanjutkan proses
              </p>
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
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                ✗ {twoFactorError}
              </p>
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
    </div>
  )
}