"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

declare global {
  interface Window {
    DocsAPI?: any
  }
}

type Props = {
  templateId: string
}

/**
 * Embed editor Word OnlyOffice buat 1 template. Load script api.js dari
 * ONLYOFFICE_PUBLIC_URL (server publik OnlyOffice, LEWAT reverse proxy host —
 * lihat catatan di docker-compose.yml), lalu init DocsAPI.DocEditor dengan
 * config yang ditandatangani JWT dari /api/admin/sumpah-template/[id]/editor-config.
 */
export function OnlyOfficeEditor({ templateId }: Props) {
  const containerId = "onlyoffice-editor-container"
  const editorRef = useRef<any>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      setError("")

      const res = await fetch(`/qr-signer/api/admin/sumpah-template/${templateId}/editor-config`)
      const data = await res.json()
      if (!res.ok) {
        if (!cancelled) {
          setError(data.error || "Gagal memuat konfigurasi editor")
          setLoading(false)
        }
        return
      }
      if (!data.publicUrl) {
        if (!cancelled) {
          setError("ONLYOFFICE_PUBLIC_URL belum diset di server")
          setLoading(false)
        }
        return
      }

      // Load api.js sekali aja — kalau sudah ada script tag-nya, langsung pakai.
      const scriptSrc = `${data.publicUrl.replace(/\/+$/, "")}/web-apps/apps/api/documents/api.js`
      if (!window.DocsAPI) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(`script[src="${scriptSrc}"]`)
          if (existing) {
            existing.addEventListener("load", () => resolve())
            return
          }
          const script = document.createElement("script")
          script.src = scriptSrc
          script.onload = () => resolve()
          script.onerror = () => reject(new Error("Gagal load script OnlyOffice — cek ONLYOFFICE_PUBLIC_URL reachable"))
          document.body.appendChild(script)
        }).catch((err) => {
          if (!cancelled) setError(err.message)
        })
      }

      if (cancelled || !window.DocsAPI) {
        if (!cancelled) setLoading(false)
        return
      }

      editorRef.current = new window.DocsAPI.DocEditor(containerId, data.config)
      if (!cancelled) setLoading(false)
    }

    init()

    return () => {
      cancelled = true
      try {
        editorRef.current?.destroyEditor?.()
      } catch {}
    }
  }, [templateId])

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <span className="leading-5">{error}</span>
      </div>
    )
  }

  return (
    <div className="relative h-[80vh] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat editor...
        </div>
      )}
      <div id={containerId} className="h-full w-full" />
    </div>
  )
}
