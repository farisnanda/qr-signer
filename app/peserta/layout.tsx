export default function PesertaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
            <img src="/qr-signer/logo.png" alt="Logo" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">SIGNER — Portal Peserta</h1>
          <p className="text-xs text-slate-400">BKD Provinsi Jawa Timur</p>
        </div>
        {children}
      </div>
    </div>
  )
}
