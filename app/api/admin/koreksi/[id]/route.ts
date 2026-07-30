import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeAgama } from "@/lib/agama"
import { normalizePangkat } from "@/lib/pangkat"
import { sendKoreksiKeputusanEmail } from "@/lib/mail"

/** Putuskan permintaan koreksi (admin): terima atau tolak. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as any)?.kind === "peserta") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const keputusan = body.keputusan === "approved" ? "approved" : body.keputusan === "rejected" ? "rejected" : null
  const catatanAdmin = String(body.catatanAdmin || "").trim() || null

  if (!keputusan) {
    return Response.json({ error: "Keputusan harus 'approved' atau 'rejected'" }, { status: 400 })
  }

  const koreksi = await prisma.koreksiData.findUnique({
    where: { id },
    include: { peserta: true },
  })
  if (!koreksi) {
    return Response.json({ error: "Permintaan tidak ditemukan" }, { status: 404 })
  }
  if (koreksi.status !== "pending") {
    return Response.json({ error: "Permintaan ini sudah diproses sebelumnya" }, { status: 409 })
  }

  let nilaiFinal = koreksi.nilaiDiminta

  if (keputusan === "approved") {
    // Validasi & normalisasi sesuai field, konsisten dengan importer.
    if (koreksi.field === "agama") {
      const a = normalizeAgama(koreksi.nilaiDiminta)
      if (!a) {
        return Response.json({ error: `Nilai agama "${koreksi.nilaiDiminta}" tidak dikenali, tidak bisa disetujui.` }, { status: 400 })
      }
      nilaiFinal = a
    } else if (koreksi.field === "pangkat") {
      const p = normalizePangkat(koreksi.nilaiDiminta)
      if (!p) {
        return Response.json({ error: `Nilai pangkat "${koreksi.nilaiDiminta}" tidak dikenali, tidak bisa disetujui.` }, { status: 400 })
      }
      nilaiFinal = p
    }

    await prisma.$transaction([
      prisma.peserta.update({
        where: { nip: koreksi.pesertaNip },
        data: { [koreksi.field]: nilaiFinal },
      }),
      prisma.koreksiData.update({
        where: { id },
        data: { status: "approved", catatanAdmin, diprosesOleh: session.user.email!, diprosesAt: new Date() },
      }),
    ])
  } else {
    await prisma.koreksiData.update({
      where: { id },
      data: { status: "rejected", catatanAdmin, diprosesOleh: session.user.email!, diprosesAt: new Date() },
    })
  }

  // Keputusan sudah tercatat di DB; kegagalan email tidak membatalkan keputusan,
  // hanya dilaporkan ke admin agar bisa ditindaklanjuti manual.
  let emailSent = false
  if (koreksi.peserta.email) {
    try {
      const mail = await sendKoreksiKeputusanEmail(
        koreksi.peserta.email,
        koreksi.peserta.nama,
        koreksi.field,
        nilaiFinal,
        keputusan === "approved",
        catatanAdmin
      )
      emailSent = mail.sent
    } catch (err: any) {
      console.error("[koreksi] gagal kirim email keputusan:", err?.message)
    }
  }

  return Response.json({ ok: true, status: keputusan, emailSent })
}
