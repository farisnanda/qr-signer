"use client"

import { useEffect, useRef, useState } from "react"
import { Rnd } from "react-rnd"

type QrPosition = {
  x: number
  y: number
  width: number
  height: number
}

type Props = {
  file: File | null
  qrValue?: string
  qrPosition?: QrPosition
  setQrPosition?: (pos: QrPosition) => void
  currentPage?: number
  setCurrentPage?: (page: number) => void
  onScaleChange?: (scale: number) => void
  onCanvasHeightChange?: (height: number) => void
}

export default function PdfViewer({
  file,
  qrPosition,
  setQrPosition,
  currentPage = 1,
  setCurrentPage,
  onScaleChange,
  onCanvasHeightChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [canvasHeight, setCanvasHeight] = useState(700)

  useEffect(() => {
    if (!file) return

    let cancelled = false

    const renderPage = async () => {
      await loadPdfjsScript()
      const pdfjs = (window as any).pdfjsLib
      if (!pdfjs || cancelled) return

      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs"

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise

      if (cancelled) return

      setTotalPages(pdf.numPages)

      const page = await pdf.getPage(currentPage)

      if (cancelled) return

      const RENDER_WIDTH = 600
      const viewport = page.getViewport({ scale: 1 })
      const scale = RENDER_WIDTH / viewport.width
      const scaledViewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height

      setCanvasHeight(scaledViewport.height)
      if (onScaleChange) onScaleChange(scale)
      if (onCanvasHeightChange) onCanvasHeightChange(scaledViewport.height)

      const ctx = canvas.getContext("2d")
      if (!ctx || cancelled) return

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
        canvas: canvas,
      })

      try {
        await renderTask.promise
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") return
        console.error(err)
      }
    }

    renderPage()

    return () => {
      cancelled = true
    }
  }, [file, currentPage])

  if (!file) {
    return (
      <div className="flex h-[700px] items-center justify-center rounded-xl border bg-slate-50">
        Belum ada PDF
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {setCurrentPage && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm">Halaman {currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}

      <div className="relative inline-block" style={{ width: 600, height: canvasHeight }}>
        <canvas ref={canvasRef} className="rounded-xl border" />

        {qrPosition && setQrPosition && (
          <Rnd
            bounds="parent"
            position={{ x: qrPosition.x, y: qrPosition.y }}
            size={{ width: qrPosition.width, height: qrPosition.height }}
            onDragStop={(_, d) =>
              setQrPosition({ ...qrPosition, x: d.x, y: d.y })
            }
            onResizeStop={(_, __, ref, ___, pos) =>
              setQrPosition({
                x: pos.x,
                y: pos.y,
                width: parseInt(ref.style.width),
                height: parseInt(ref.style.height),
              })
            }
            className="absolute z-10 cursor-move rounded border-2 border-dashed border-blue-500 bg-white/80"
          >
            <div className="flex h-full w-full items-center justify-center text-xs text-blue-600">
              QR Code
            </div>
          </Rnd>
        )}
      </div>
    </div>
  )
}

function loadPdfjsScript(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).pdfjsLib) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.mjs"
    script.type = "module"
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}