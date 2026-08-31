"use client"

import { useEffect, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import {
  AlertTriangle, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Loader2, Save, Undo2, Redo2, List, ListOrdered, Heading1, Heading2,
} from "lucide-react"
import { toast } from "sonner"

type Props = {
  templateId: string
}

/**
 * Editor rich-text mirip Microsoft Word — GANTI OnlyOffice (ribet deploy-nya
 * di VPS ini). Docx dikonversi ke HTML (mammoth) buat ditampilkan di sini,
 * diedit pake Tiptap (npm package biasa, ga butuh container/service
 * tambahan), disimpan dikonversi balik ke docx (html-to-docx).
 */
export function HtmlTemplateEditor({ templateId }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    editorProps: {
      attributes: {
        class: "word-page focus:outline-none",
      },
    },
    content: "",
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`/qr-signer/api/admin/sumpah-template/${templateId}/html`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Gagal memuat template")
        if (!cancelled && editor) editor.commands.setContent(data.html)
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Gagal memuat template")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (editor) load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, editor])

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    try {
      const html = editor.getHTML()
      const res = await fetch(`/qr-signer/api/admin/sumpah-template/${templateId}/save-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan")
      toast.success("Template tersimpan")
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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      {/* Toolbar ala ribbon Word */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
        <ToolbarButton active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} icon={Heading1} label="Judul 1" />
        <ToolbarButton active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} icon={Heading2} label="Judul 2" />
        <div className="mx-1 h-5 w-px bg-slate-300" />
        <ToolbarButton active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} icon={Bold} label="Tebal" />
        <ToolbarButton active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} icon={Italic} label="Miring" />
        <ToolbarButton active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} icon={UnderlineIcon} label="Garis bawah" />
        <div className="mx-1 h-5 w-px bg-slate-300" />
        <ToolbarButton active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} icon={AlignLeft} label="Rata kiri" />
        <ToolbarButton active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} icon={AlignCenter} label="Tengah" />
        <ToolbarButton active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()} icon={AlignRight} label="Rata kanan" />
        <ToolbarButton active={editor?.isActive({ textAlign: "justify" })} onClick={() => editor?.chain().focus().setTextAlign("justify").run()} icon={AlignJustify} label="Rata kanan-kiri" />
        <div className="mx-1 h-5 w-px bg-slate-300" />
        <ToolbarButton active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} icon={List} label="Daftar bullet" />
        <ToolbarButton active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} icon={ListOrdered} label="Daftar nomor" />
        <div className="mx-1 h-5 w-px bg-slate-300" />
        <ToolbarButton onClick={() => editor?.chain().focus().undo().run()} icon={Undo2} label="Undo" />
        <ToolbarButton onClick={() => editor?.chain().focus().redo().run()} icon={Redo2} label="Redo" />
        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Menyimpan..." : "Simpan perubahan"}
          </button>
        </div>
      </div>

      {/* Area kerja abu-abu, halaman putih di tengah kayak Word */}
      <div className="relative max-h-[75vh] overflow-y-auto px-6 py-8">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-slate-100/90 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat template...
          </div>
        )}
        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        .word-page {
          background: white;
          max-width: 21cm;
          min-height: 29.7cm;
          margin: 0 auto;
          padding: 2.5cm;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05);
          font-family: "Times New Roman", Georgia, serif;
          font-size: 12pt;
          line-height: 1.6;
          color: #1e293b;
        }
        .word-page p { margin: 0 0 0.5em 0; }
        .word-page h1 { font-size: 18pt; font-weight: 700; margin: 0.5em 0; }
        .word-page h2 { font-size: 14pt; font-weight: 700; margin: 0.5em 0; }
        .word-page ul, .word-page ol { padding-left: 1.5em; margin: 0.5em 0; }
        .word-page table { border-collapse: collapse; width: 100%; }
        .word-page table td, .word-page table th { border: 1px solid #cbd5e1; padding: 0.4em 0.6em; }
      `}</style>
    </div>
  )
}

function ToolbarButton({ onClick, icon: Icon, label, active }: { onClick: () => void; icon: any; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`rounded-md p-1.5 ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
