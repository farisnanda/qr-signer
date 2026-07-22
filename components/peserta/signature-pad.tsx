"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Canvas tanda tangan. Gambar dengan mouse/touch (pointer events), latar
 * transparan, garis hitam. Saat simpan: crop ke bounding box goresan agar PNG
 * rapat, lalu POST ke /api/peserta/signature.
 */
export function SignaturePad({ initialUrl }: { initialUrl?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const bounds = useRef({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
  const dirty = useRef(false)

  const [saving, setSaving] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(initialUrl ?? null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Skala untuk ketajaman (retina).
    const ratio = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    canvas.width = cssW * ratio
    canvas.height = cssH * ratio
    const ctx = canvas.getContext("2d")!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"
  }, [])

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent) {
    e.preventDefault()
    drawing.current = true
    dirty.current = true
    last.current = pos(e)
    canvasRef.current!.setPointerCapture(e.pointerId)
    track(last.current)
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext("2d")!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current!.x, last.current!.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    track(p)
  }

  function end() {
    drawing.current = false
    last.current = null
  }

  function track(p: { x: number; y: number }) {
    const b = bounds.current
    b.minX = Math.min(b.minX, p.x)
    b.minY = Math.min(b.minY, p.y)
    b.maxX = Math.max(b.maxX, p.x)
    b.maxY = Math.max(b.maxY, p.y)
  }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    bounds.current = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    dirty.current = false
    setError("")
    setMessage("")
  }

  function exportTrimmed(): string | null {
    const canvas = canvasRef.current!
    const ratio = window.devicePixelRatio || 1
    const b = bounds.current
    if (!isFinite(b.minX)) return null
    const pad = 8
    const x = Math.max(0, (b.minX - pad)) * ratio
    const y = Math.max(0, (b.minY - pad)) * ratio
    const w = Math.min(canvas.width - x, (b.maxX - b.minX + pad * 2) * ratio)
    const h = Math.min(canvas.height - y, (b.maxY - b.minY + pad * 2) * ratio)
    if (w <= 0 || h <= 0) return null

    const out = document.createElement("canvas")
    out.width = Math.round(w)
    out.height = Math.round(h)
    out.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height)
    return out.toDataURL("image/png")
  }

  async function save() {
    setError("")
    setMessage("")
    if (!dirty.current) {
      setError("Gambar tanda tangan Anda terlebih dahulu.")
      return
    }
    const dataUrl = exportTrimmed()
    if (!dataUrl) {
      setError("Tanda tangan kosong.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/qr-signer/api/peserta/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan")
        return
      }
      setSavedUrl(`/qr-signer/api/peserta/signature?t=${Date.now()}`)
      setMessage("Tanda tangan tersimpan.")
      dirty.current = false
    } catch {
      setError("Terjadi kesalahan koneksi.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {savedUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Tanda tangan tersimpan saat ini:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={savedUrl} alt="Tanda tangan tersimpan" className="max-h-24 object-contain" />
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">{savedUrl ? "Gambar ulang tanda tangan" : "Gambar tanda tangan Anda"}</p>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}

      <div className="flex gap-2">
        <button onClick={clear} type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          Bersihkan
        </button>
        <button onClick={save} disabled={saving} type="button" className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Menyimpan..." : "Simpan Tanda Tangan"}
        </button>
      </div>
    </div>
  )
}
