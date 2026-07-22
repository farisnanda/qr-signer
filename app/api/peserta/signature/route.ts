import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadToMinio, downloadFromMinio } from "@/lib/minio"

const BUCKET = "ttd-peserta"
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const nip = (session?.user as any)?.nip
  if (!nip || (session?.user as any)?.kind !== "peserta") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const dataUrl = String(body.dataUrl || "")
  const m = dataUrl.match(/^data:image\/png;base64,(.+)$/)
  if (!m) {
    return Response.json({ error: "Format gambar tidak valid (harus PNG)" }, { status: 400 })
  }

  const buffer = Buffer.from(m[1], "base64")
  if (buffer.length === 0 || !buffer.subarray(0, 4).equals(PNG_MAGIC)) {
    return Response.json({ error: "Data PNG tidak valid" }, { status: 400 })
  }
  if (buffer.length > MAX_BYTES) {
    return Response.json({ error: "Gambar terlalu besar" }, { status: 413 })
  }

  const objectName = `ttd_${nip}.png`
  try {
    await uploadToMinio(BUCKET, objectName, buffer)
    await prisma.peserta.update({
      where: { nip },
      data: { signatureKey: `${BUCKET}/${objectName}` },
    })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err?.message || "Gagal simpan tanda tangan" }, { status: 500 })
  }
}

/** Proxy gambar TTD peserta yang sedang login (same-origin, hindari isu
 * cert/CORS presigned URL di browser). */
export async function GET() {
  const session = await getServerSession(authOptions)
  const nip = (session?.user as any)?.nip
  if (!nip || (session?.user as any)?.kind !== "peserta") {
    return new Response("Unauthorized", { status: 401 })
  }

  const peserta = await prisma.peserta.findUnique({
    where: { nip },
    select: { signatureKey: true },
  })
  if (!peserta?.signatureKey) {
    return new Response("Not found", { status: 404 })
  }

  const [bucket, ...rest] = peserta.signatureKey.split("/")
  try {
    const buf = await downloadFromMinio(bucket, rest.join("/"))
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-cache" },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
