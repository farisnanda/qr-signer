import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PencilLine } from "lucide-react"
import { PesertaLogout } from "@/components/peserta/logout-button"
import { PesertaWorkspace } from "@/components/peserta/workspace"

export const dynamic = "force-dynamic"

export default async function PesertaHome() {
  const session = await getServerSession(authOptions)
  const nip = (session?.user as any)?.nip
  if (!nip) redirect("/peserta/login")

  const peserta = await prisma.peserta.findUnique({
    where: { nip },
    select: { nama: true, nip: true, pangkat: true, perangkatDaerah: true, agama: true, email: true, signatureKey: true },
  })
  if (!peserta) redirect("/peserta/login")

  // Gambar TTD dilayani via proxy same-origin (hindari isu cert/CORS Minio).
  const signatureUrl = peserta.signatureKey ? `/qr-signer/api/peserta/signature?t=${Date.now()}` : null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Halo, {peserta.nama}</h2>
          <p className="text-sm text-slate-500">Selamat datang di portal peserta.</p>
        </div>
        <PesertaLogout />
      </div>

      <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        {[
          ["NIP", peserta.nip],
          ["Pangkat", peserta.pangkat],
          ["Perangkat Daerah", peserta.perangkatDaerah],
          ["Agama", peserta.agama],
          ["Email", peserta.email],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <PencilLine className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-950">Perlu koreksi data?</p>
              <p className="mt-0.5 text-xs font-medium leading-5 text-amber-900">
                Ajukan pembaruan jika nama, pangkat, agama, atau perangkat daerah belum sesuai.
              </p>
            </div>
          </div>
          <Link
            href="/peserta/koreksi"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700"
          >
            Ajukan Koreksi
          </Link>
        </div>
      </div>

      <PesertaWorkspace initialSignatureUrl={signatureUrl} initialHasSignature={!!peserta.signatureKey} />
    </div>
  )
}
