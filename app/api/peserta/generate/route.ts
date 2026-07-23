import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadToMinio, downloadFromMinio } from "@/lib/minio"
import { generateSumpahPdf, stampSignatureOnPdf, getSumpahFilename } from "@/lib/sumpah"
import { getJabatan } from "@/lib/pangkat"

// Simpan ke bucket "bkd" path "sk_pns/". Tanggal penamaan FIX 01012026.
const BUCKET = "bkd"
const PREFIX = "sk_pns"
const FIXED_DATE = "01062026"

// Posisi default TTD (fraksi halaman) — kolom "Yang mengangkat sumpah" kiri.
// Bisa ditimpa client di Fase 3c (preview + geser).
const DEFAULT_PLACE = { xFrac: 0.16, yFracTop: 0.72, wFrac: 0.15 }

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const nip = (session?.user as any)?.nip
  if (!nip || (session?.user as any)?.kind !== "peserta") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const pin = String(body.pin || "").trim()
  const preview = body.preview === true
  const place = {
    xFrac: typeof body.xFrac === "number" ? body.xFrac : DEFAULT_PLACE.xFrac,
    yFracTop: typeof body.yFracTop === "number" ? body.yFracTop : DEFAULT_PLACE.yFracTop,
    wFrac: typeof body.wFrac === "number" ? body.wFrac : DEFAULT_PLACE.wFrac,
  }

  if (!pin) {
    return Response.json({ error: "PIN sesi wajib diisi" }, { status: 400 })
  }

  // Validasi PIN → sesi aktif.
  const sesi = await prisma.sesi.findFirst({ where: { pin, aktif: true } })
  if (!sesi) {
    return Response.json({ error: "PIN tidak valid atau sesi tidak aktif" }, { status: 403 })
  }

  const peserta = await prisma.peserta.findUnique({ where: { nip } })
  if (!peserta) {
    return Response.json({ error: "Peserta tidak ditemukan" }, { status: 404 })
  }
  if (!peserta.signatureKey) {
    return Response.json({ error: "Anda belum menyimpan tanda tangan" }, { status: 400 })
  }

  const agama = peserta.agama as "Islam" | "Kristen" | "Budha" | "Hindu" | "Katolik"
  const jabatan = getJabatan(peserta.pangkat)

  try {
    // 1. Generate BA (substitusi nama/nip/jabatan, paksa 1 halaman)
    const basePdf = await generateSumpahPdf({ nama: peserta.nama, nip, jabatan, agama }, { singlePage: true })

    // Mode preview: kembalikan BA dasar (tanpa TTD, tanpa simpan/catat) untuk
    // ditata posisinya di client.
    if (preview) {
      return new Response(new Uint8Array(basePdf), {
        headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
      })
    }

    // 2. Ambil PNG tanda tangan dari Minio
    const [sigBucket, ...sigRest] = peserta.signatureKey.split("/")
    const sigPng = await downloadFromMinio(sigBucket, sigRest.join("/"))

    // 3. Stamp TTD ke PDF
    const finalPdf = await stampSignatureOnPdf(basePdf, sigPng, place)

    // 4. Simpan ke Minio: bkd/sk_pns/SUMPAH_PNS_01012026_<NIP>.pdf
    const objectName = `${PREFIX}/${getSumpahFilename(nip, FIXED_DATE)}`
    await uploadToMinio(BUCKET, objectName, finalPdf)

    // 5. Catat kehadiran (upsert)
    await prisma.kehadiran.upsert({
      where: { sesiId_pesertaNip: { sesiId: sesi.id, pesertaNip: nip } },
      create: { sesiId: sesi.id, pesertaNip: nip, pesertaNama: peserta.nama, dokumenKey: `${BUCKET}/${objectName}` },
      update: { dokumenKey: `${BUCKET}/${objectName}` },
    })

    // Kembalikan PDF untuk preview/unduh
    return new Response(new Uint8Array(finalPdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${objectName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    return Response.json({ error: err?.message || "Gagal generate dokumen" }, { status: 500 })
  }
}
