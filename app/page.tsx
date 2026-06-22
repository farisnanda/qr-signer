import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect("/admin")

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">

      {/* Background blur */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 -left-60 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-60 -right-60 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-slate-800/30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg text-center">

        {/* Logo */}
        <div className="mb-8">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 ring-1 ring-white/20">
            <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight">SUPER</h1>
          <p className="mt-2 text-slate-400">Badan Kepegawaian Daerah Provinsi Jawa Timur</p>
        </div>

        {/* Tagline */}
        <div className="mb-6">
          <p className="text-xl font-medium text-white leading-relaxed">
            Platform Penandatanganan<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Dokumen Digital
            </span>
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Solusi modern untuk penandatanganan massal SK dan dokumen resmi BKD Jawa Timur
          </p>
        </div>

        {/* Badge BSrE */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
            <img src="/logo-bsre.png" alt="BSrE" className="h-6 object-contain brightness-0 invert opacity-70" />
            <span className="text-xs text-slate-400">Terintegrasi dengan BSrE BSSN</span>
          </div>
        </div>

        {/* Fitur */}
        <div className="mb-10 grid grid-cols-2 gap-3">
          {[
            { icon: "✍️", text: "Bulk Sign SK", desc: "Generate SK massal dari Excel" },
            { icon: "📄", text: "Bulk Sign PDF", desc: "QR verifikasi otomatis" },
            { icon: "🔐", text: "Keamanan 2FA", desc: "Autentikasi dua faktor" },
            { icon: "📋", text: "Riwayat Lengkap", desc: "Jejak audit dokumen" },
          ].map((f) => (
            <div key={f.text} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left backdrop-blur-sm">
              <span className="text-xl">{f.icon}</span>
              <p className="mt-2 text-sm font-semibold text-white">{f.text}</p>
              <p className="text-xs text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-bold text-slate-900 transition hover:bg-slate-100 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Masuk ke SUPER
        </Link>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 opacity-30">
            <img src="/logo-bsre.png" alt="BSrE" className="h-5 object-contain brightness-0 invert" />
          </div>
          <p className="text-xs text-slate-700">
            Dokumen ditandatangani secara elektronik menggunakan sertifikat digital BSrE
          </p>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Badan Kepegawaian Daerah Provinsi Jawa Timur
          </p>
        </div>

      </div>
    </div>
  )
}