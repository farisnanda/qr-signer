"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FilePlus2, Loader2, PenLine } from "lucide-react"

type Template = {
  id: string
  agama: string
  versi: string
  updatedAt: string
  updatedBy: string | null
}

const AGAMA_LIST = ["Islam", "Kristen", "Budha", "Hindu", "Katolik"] as const

export function SumpahTemplateList() {
  const [list, setList] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [agama, setAgama] = useState<string>(AGAMA_LIST[0])
  const [versi, setVersi] = useState("standar")
  const [mode, setMode] = useState<"upload" | "clone">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [cloneFromId, setCloneFromId] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    const res = await fetch("/qr-signer/api/admin/sumpah-template")
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || "Gagal memuat daftar template")
      return
    }
    setList(data.list)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError("")

    const fd = new FormData()
    fd.append("agama", agama)
    fd.append("versi", versi)
    if (mode === "upload") {
      if (!file) {
        setFormError("Pilih file .docx dulu")
        setSaving(false)
        return
      }
      fd.append("file", file)
    } else {
      if (!cloneFromId) {
        setFormError("Pilih template sumber buat di-clone")
        setSaving(false)
        return
      }
      fd.append("cloneFromId", cloneFromId)
    }

    const res = await fetch("/qr-signer/api/admin/sumpah-template", { method: "POST", body: fd })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setFormError(data.error || "Gagal membuat template")
      return
    }
    setShowForm(false)
    setFile(null)
    setCloneFromId("")
    setVersi("standar")
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span className="leading-5">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{list.length} template terdaftar.</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800"
        >
          <FilePlus2 className="h-4 w-4" />
          Versi Baru
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-800">Agama</label>
              <select
                value={agama}
                onChange={(e) => setAgama(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {AGAMA_LIST.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-800">Versi</label>
              <input
                value={versi}
                onChange={(e) => setVersi(e.target.value)}
                placeholder="standar"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                "standar" = format default. Nilai lain = ini yang diisi peserta di kolom Excel "versi".
              </p>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "upload"} onChange={() => setMode("upload")} />
              Upload file .docx baru
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "clone"} onChange={() => setMode("clone")} />
              Duplikat dari template lain
            </label>
          </div>

          {mode === "upload" ? (
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          ) : (
            <select
              value={cloneFromId}
              onChange={(e) => setCloneFromId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Pilih template sumber...</option>
              {list.map((t) => (
                <option key={t.id} value={t.id}>{t.agama} — {t.versi}</option>
              ))}
            </select>
          )}

          {formError && <p className="text-sm font-semibold text-red-700">{formError}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Membuat..." : "Buat Template"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Agama</th>
              <th className="px-4 py-3">Versi</th>
              <th className="px-4 py-3">Terakhir diubah</th>
              <th className="px-4 py-3">Oleh</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{t.agama}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{t.versi}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{new Date(t.updatedAt).toLocaleString("id-ID")}</td>
                <td className="px-4 py-3 text-slate-600">{t.updatedBy || "-"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/settings/sumpah-template/${t.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada template. Buat "Versi Baru" di atas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
