export default function PesertaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 sm:py-10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-300/70 ring-4 ring-white/70">
            <img src="/qr-signer/logo.png" alt="Logo BKD" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-blue-950">
            SIGNER - <span className="text-teal-700">Portal Peserta</span>
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-700">BKD Provinsi Jawa Timur</p>
        </div>
        {children}
      </div>
    </div>
  )
}
