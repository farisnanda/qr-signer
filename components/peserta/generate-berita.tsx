"use client"

import { useEffect, useRef, useState } from "react"
import { Rnd } from "react-rnd"

const RENDER_WIDTH = 600
const PDF_JS = "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.mjs"
const PDF_WORKER = "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs"

function loadPdfjs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) return resolve((window as any).pdfjsLib)
    const s = document.createElement("script")
    s.src = PDF_JS
    s.type = "module"
    s.onload = () => resolve((window as any).pdfjsLib)
    s.onerror = () => reject(new Error("Gagal memuat penampil PDF"))
    document.head.appendChild(s)
  })
}

type Box = { x: number; y: number; width: number; height: number }

export function GenerateBerita({ hasSignature }: { hasSignature: boolean }) {
  const [pin, setPin] = useState("")
  const [stage, setStage] = useState<"input" | "place" | "done">("input")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [canvasHeight, setCanvasHeight] = useState(0)
  const [box, setBox] = useState<Box>({ x: 72, y: 600, width: 132, height: 45 })
  const sigRatio = useRef(95 / 277) // tinggi/lebar TTD; diperbarui saat gambar dimuat
  const [finalUrl, setFinalUrl] = useState<string | null>(null)

  // Muat rasio asli TTD agar kotak overlay WYSIWYG dengan hasil stamp.
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0) sigRatio.current = img.naturalHeight / img.naturalWidth
    }
    img.src = `/qr-signer/api/peserta/signature?t=${Date.now()}`
  }, [])

  // Render BA dasar ke canvas begitu masuk tahap "place".
  useEffect(() => {
    if (stage !== "place" || !previewBlob) return
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await loadPdfjs()
        if (cancelled) return
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER
        const buf = await previewBlob.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: buf }).promise
        const page = await pdf.getPage(1)
        const scale = RENDER_WIDTH / page.getViewport({ scale: 1 }).width
        const vp = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = vp.width
        canvas.height = vp.height
        setCanvasHeight(vp.height)
        // Posisi default TTD di kolom "Yang mengangkat sumpah".
        const w = 0.22 * RENDER_WIDTH
        setBox({ x: 0.12 * RENDER_WIDTH, y: 0.72 * vp.height, width: w, height: w * sigRatio.current })
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Gagal menampilkan preview")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stage, previewBlob])

  async function buatPreview(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim()) {
      setError("Masukkan PIN sesi dari panitia.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/qr-signer/api/peserta/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin, preview: true }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || "Gagal membuat preview")
        return
      }
      setPreviewBlob(await res.blob())
      setStage("place")
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  async function finalisasi() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/qr-signer/api/peserta/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pin,
          xFrac: box.x / RENDER_WIDTH,
          yFracTop: box.y / canvasHeight,
          wFrac: box.width / RENDER_WIDTH,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || "Gagal finalisasi")
        return
      }
      setFinalUrl(URL.createObjectURL(await res.blob()))
      setStage("done")
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  function ulang() {
    setStage("input")
    setPreviewBlob(null)
    setFinalUrl(null)
    setError("")
  }

  if (!hasSignature) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-sm text-amber-700">
        Simpan tanda tangan Anda dulu sebelum membuat Berita Acara.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {stage === "input" && (
        <form onSubmit={buatPreview} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">PIN Sesi</label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm tracking-widest"
              placeholder="PIN dari panitia"
            />
            <p className="mt-1 text-xs text-slate-400">Masukkan PIN yang diberikan panitia di lokasi.</p>
          </div>
          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Memproses..." : "Buat Berita Acara"}
          </button>
        </form>
      )}

      {stage === "place" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Geser & atur ukuran tanda tangan ke posisi yang tepat, lalu finalisasi.</p>
          <div className="overflow-auto">
            <div className="relative mx-auto" style={{ width: RENDER_WIDTH, height: canvasHeight || 400 }}>
              <canvas ref={canvasRef} className="rounded-lg border border-slate-200" />
              {canvasHeight > 0 && (
                <Rnd
                  bounds="parent"
                  lockAspectRatio
                  position={{ x: box.x, y: box.y }}
                  size={{ width: box.width, height: box.height }}
                  onDragStop={(_, d) => setBox((b) => ({ ...b, x: d.x, y: d.y }))}
                  onResizeStop={(_, __, ref, ___, pos) =>
                    setBox({ x: pos.x, y: pos.y, width: parseFloat(ref.style.width), height: parseFloat(ref.style.height) })
                  }
                  className="z-10 cursor-move rounded border border-dashed border-blue-500"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/qr-signer/api/peserta/signature?t=${Date.now()}`} alt="TTD" className="h-full w-full object-contain" draggable={false} />
                </Rnd>
              )}
            </div>
          </div>
          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button onClick={ulang} type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
              Batal
            </button>
            <button onClick={finalisasi} disabled={loading} type="button" className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Menyimpan..." : "Finalisasi & Simpan"}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && finalUrl && (
        <div className="space-y-3 text-center">
          <div className="text-4xl">✅</div>
          <p className="text-sm font-medium text-slate-900">Berita Acara selesai & tersimpan.</p>
          <iframe src={finalUrl} className="h-96 w-full rounded-lg border border-slate-200" title="Berita Acara" />
          <div className="flex gap-2">
            <a href={finalUrl} download="Berita-Acara-Sumpah.pdf" className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
              Unduh PDF
            </a>
            <button onClick={ulang} type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
              Buat Ulang
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
