"use client"

import { useState } from "react"
import { SignaturePad } from "@/components/peserta/signature-pad"
import { GenerateBerita } from "@/components/peserta/generate-berita"

/**
 * Menyatukan bagian Tanda Tangan & Berita Acara dalam satu state client, agar
 * begitu TTD disimpan, bagian PIN (Berita Acara) langsung aktif TANPA refresh.
 */
export function PesertaWorkspace({
  initialSignatureUrl,
  initialHasSignature,
}: {
  initialSignatureUrl: string | null
  initialHasSignature: boolean
}) {
  const [hasSignature, setHasSignature] = useState(initialHasSignature)

  return (
    <>
      <div className="mt-6 border-t border-slate-100 pt-5">
        <h3 className="mb-1 text-sm font-bold text-slate-900">Tanda Tangan</h3>
        <p className="mb-3 text-xs text-slate-500">Gambar tanda tangan Anda. Nanti dipakai pada Berita Acara.</p>
        <SignaturePad initialUrl={initialSignatureUrl} onSaved={() => setHasSignature(true)} />
      </div>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <h3 className="mb-1 text-sm font-bold text-slate-900">Berita Acara Sumpah</h3>
        <p className="mb-3 text-xs text-slate-500">Masukkan PIN dari panitia, atur posisi tanda tangan, lalu simpan.</p>
        <GenerateBerita hasSignature={hasSignature} />
      </div>
    </>
  )
}
