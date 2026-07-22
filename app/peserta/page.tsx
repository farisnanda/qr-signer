import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
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

      <PesertaWorkspace initialSignatureUrl={signatureUrl} initialHasSignature={!!peserta.signatureKey} />
    </div>
  )
}
