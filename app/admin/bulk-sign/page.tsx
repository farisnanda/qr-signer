import { BulkUploadForm } from "@/components/bulk-sign/bulk-upload-form"

export default function BulkSignPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bulk Sign</h1>
        <p className="mt-1 text-sm text-slate-500">Upload banyak PDF sekaligus dan tambahkan QR verifikasi otomatis.</p>
      </div>

      <BulkUploadForm />
    </div>
  )
}