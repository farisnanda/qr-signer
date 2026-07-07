import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function formatTanggal(date: Date) {
  return new Date(date).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const document = await prisma.document.findUnique({
    where: { verifyToken: token },
  })

  const fileName = document?.filePath?.split("/").pop()
  const fileUrl = fileName ? `/qr-signer/api/files/${fileName}` : null

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <img src="/qr-signer/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">Verifikasi Dokumen</h1>
          <p className="mt-1 text-sm text-slate-400">
            Badan Kepegawaian Daerah Provinsi Jawa Timur
          </p>
        </div>

        {document ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
            <div className="flex items-center gap-3 border-b bg-green-50 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-green-700">Dokumen Terverifikasi</p>
                <p className="text-xs text-green-600">
                  Dokumen ini asli dan ditandatangani secara elektronik.
                </p>
              </div>
            </div>

            <dl className="divide-y">
              <div className="grid grid-cols-3 gap-4 px-6 py-4">
                <dt className="text-sm text-slate-500">Judul</dt>
                <dd className="col-span-2 text-sm font-medium text-slate-800">{document.title}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 px-6 py-4">
                <dt className="text-sm text-slate-500">Nomor Dokumen</dt>
                <dd className="col-span-2 font-mono text-sm text-slate-800 break-all">{document.documentNo}</dd>
              </div>
              {document.documentDate && (
                <div className="grid grid-cols-3 gap-4 px-6 py-4">
                  <dt className="text-sm text-slate-500">Tanggal Dokumen</dt>
                  <dd className="col-span-2 text-sm text-slate-800">{formatTanggal(document.documentDate)}</dd>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 px-6 py-4">
                <dt className="text-sm text-slate-500">Ditandatangani</dt>
                <dd className="col-span-2 text-sm text-slate-800">{formatTanggal(document.createdAt)}</dd>
              </div>
            </dl>

            {fileUrl && (
              <div className="border-t px-6 py-4">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Lihat Dokumen
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
            <div className="flex items-center gap-3 border-b bg-red-50 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-red-700">Dokumen Tidak Ditemukan</p>
                <p className="text-xs text-red-600">
                  Kode verifikasi tidak valid atau dokumen tidak terdaftar.
                </p>
              </div>
            </div>
            <div className="px-6 py-6 text-center text-sm text-slate-500">
              Pastikan Anda memindai QR code dari dokumen resmi BKD Provinsi Jawa Timur.
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} Badan Kepegawaian Daerah Provinsi Jawa Timur
        </p>
      </div>
    </div>
  )
}
