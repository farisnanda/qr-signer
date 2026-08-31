"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Loader2, Save, Undo2, Redo2 } from "lucide-react"
import { toast } from "sonner"

type Props = {
  templateId: string
}

/**
 * Editor rich-text ringan buat template docx — GANTI OnlyOffice (ribet
 * deploy-nya di VPS ini). Docx dikonversi ke HTML (mammoth) buat ditampilkan,
 * diedit langsung di div contentEditable + toolbar dasar (bold/italic/underline/
 * align), disimpan dikonversi balik ke docx (html-to-docx) via /save-html.
 * Ga butuh container/service tambahan, ga ada signature/token/build-cache
 * yang bisa bikin gagal deploy.
 */
export function HtmlTemplateEditor({ templateId }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`/qr-signer/api/admin/sumpah-template/${templateId}/html`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Gagal memuat template")
        if (!cancelled && editorRef.current) {
          editorRef.current.innerHTML = data.html
          setDirty(false)
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Gagal memuat template")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [templateId])

  function exec(command: string) {
    document.execCommand(command)
    editorRef.current?.focus()
    setDirty(true)
  }

  async function handleSave() {
    if (!editorRef.current) return
    setSaving(true)
    try {
      const html = editorRef.current.innerHTML
      const res = await fetch(`/qr-signer/api/admin/sumpah-template/${templateId}/save-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan")
      toast.success("Template tersimpan")
      setDirty(false)
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <span className="leading-5">{error}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <ToolbarButton onClick={() => exec("bold")} icon={Bold} label="Tebal" />
        <ToolbarButton onClick={() => exec("italic")} icon={Italic} label="Miring" />
        <ToolbarButton onClick={() => exec("underline")} icon={Underline} label="Garis bawah" />
        <div className="mx-1 h-5 w-px bg-slate-300" />
        <ToolbarButton onClick={() => exec("justifyLeft")} icon={AlignLeft} label="Rata kiri" />
        <ToolbarButton onClick={() => exec("justifyCenter")} icon={AlignCenter} label="Tengah" />
        <ToolbarButton onClick={() => exec("justifyRight")} icon={AlignRight} label="Rata kanan" />
        <div className="mx-1 h-5 w-px bg-slate-300" />
        <ToolbarButton onClick={() => exec("undo")} icon={Undo2} label="Undo" />
        <ToolbarButton onClick={() => exec("redo")} icon={Redo2} label="Redo" />
        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Menyimpan..." : dirty ? "Simpan perubahan" : "Simpan"}
          </button>
        </div>
      </div>

      <div className="relative min-h-[70vh]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat template...
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setDirty(true)}
          className="prose prose-sm max-w-none min-h-[70vh] px-8 py-6 focus:outline-none"
        />
      </div>
    </div>
  )
}

function ToolbarButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: any; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
