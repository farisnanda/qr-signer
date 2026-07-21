import { SumpahUploadForm } from "@/components/sumpah/upload-form"

export default function BeritaAcaraSumpahPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Berita Acara Sumpah</h1>
        <p className="mt-1 text-sm text-slate-500">Generate Berita Acara Sumpah PNS dari data Excel dan upload ke Minio secara individual.</p>
      </div>

      <SumpahUploadForm />
    </div>
  )
}
