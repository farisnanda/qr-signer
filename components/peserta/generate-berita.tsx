"use client"

import { useEffect, useRef, useState } from "react"
import { Rnd } from "react-rnd"

const MAX_WIDTH = 600
// Posisi & ukuran default kotak TTD (fraksi halaman) — dikalibrasi tepat di
// kolom "Yang mengangkat sumpah", di atas nama peserta.
const DEFAULT_PLACE = { xFrac: 0.16, yFracTop: 0.72, wFrac: 0.15 }
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
  const wrapRef = useRef<HTMLDivElement>(null)
  const [renderWidth, setRenderWidth] = useState(MAX_WIDTH)
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
        if (cancelled) return
        // Lebar render mengikuti lebar kontainer (maks MAX_WIDTH) agar PDF muat
        // penuh tanpa perlu geser samping. Koordinat TTD tetap fraksional.
        const rw = Math.min(wrapRef.current?.clientWidth || MAX_WIDTH, MAX_WIDTH)
        const scale = rw / page.getViewport({ scale: 1 }).width
        const vp = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = vp.width
        canvas.height = vp.height
        // Set renderWidth & box BERSAMAAN setelah cek cancelled, agar keduanya
        // pakai rw yang sama (hindari race dev strict-mode -> posisi meleset).
        setRenderWidth(rw)
        setCanvasHeight(vp.height)
        const w = DEFAULT_PLACE.wFrac * rw
        setBox({ x: DEFAULT_PLACE.xFrac * rw, y: DEFAULT_PLACE.yFracTop * vp.height, width: w, height: w * sigRatio.current })
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
          xFrac: box.x / renderWidth,
          yFracTop: box.y / canvasHeight,
          wFrac: box.width / renderWidth,
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

  // Geser halus (presisi) — melengkapi drag yang kasar di preview kecil.
  function nudge(dx: number, dy: number) {
    setBox((b) => ({
      ...b,
      x: Math.max(0, Math.min(renderWidth - b.width, b.x + dx)),
      y: Math.max(0, Math.min(canvasHeight - b.height, b.y + dy)),
    }))
  }

  // Ubah ukuran (jaga rasio TTD), tetap dalam batas halaman.
  function resizeBox(delta: number) {
    setBox((b) => {
      const width = Math.max(30, Math.min(renderWidth, b.width + delta))
      const height = width * sigRatio.current
      return {
        width,
        height,
        x: Math.max(0, Math.min(renderWidth - width, b.x)),
        y: Math.max(0, Math.min(canvasHeight - height, b.y)),
      }
    })
  }

  // Langkah geser/ukuran proporsional terhadap lebar render.
  const step = Math.max(2, Math.round(renderWidth * 0.012))

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
          <p className="text-sm text-slate-600">Seret tanda tangan ke posisi yang tepat. Untuk presisi, gunakan tombol geser & ukuran di bawah preview.</p>
          <div ref={wrapRef} className="w-full overflow-hidden">
            <div className="relative mx-auto" style={{ width: renderWidth, height: canvasHeight || 400 }}>
              <canvas ref={canvasRef} className="w-full rounded-lg border border-slate-200" />
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

          {/* Kontrol presisi: geser halus & ubah ukuran */}
          {canvasHeight > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-slate-500">Geser</span>
                {[
                  { l: "←", dx: -step, dy: 0 },
                  { l: "↑", dx: 0, dy: -step },
                  { l: "↓", dx: 0, dy: step },
                  { l: "→", dx: step, dy: 0 },
                ].map((b) => (
                  <button key={b.l} type="button" onClick={() => nudge(b.dx, b.dy)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-base leading-none text-slate-700 transition hover:bg-slate-100">
                    {b.l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-slate-500">Ukuran</span>
                <button type="button" onClick={() => resizeBox(-step * 2)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg leading-none text-slate-700 transition hover:bg-slate-100">−</button>
                <button type="button" onClick={() => resizeBox(step * 2)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg leading-none text-slate-700 transition hover:bg-slate-100">+</button>
              </div>
            </div>
          )}

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
