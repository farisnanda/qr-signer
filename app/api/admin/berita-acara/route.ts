import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { downloadFromMinio } from "@/lib/minio"

/** Proxy unduh BA peserta (admin). ?nip=... */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as any)?.kind === "peserta") {
    return new Response("Unauthorized", { status: 401 })
  }

  const nip = new URL(request.url).searchParams.get("nip")?.trim()
  if (!nip) return new Response("NIP wajib", { status: 400 })

  // Ambil dokumenKey dari kehadiran terbaru peserta ini.
  const kehadiran = await prisma.kehadiran.findFirst({
    where: { pesertaNip: nip, dokumenKey: { not: null } },
    orderBy: { checkedInAt: "desc" },
  })
  if (!kehadiran?.dokumenKey) return new Response("Dokumen tidak ditemukan", { status: 404 })

  const [bucket, ...rest] = kehadiran.dokumenKey.split("/")
  try {
    const buf = await downloadFromMinio(bucket, rest.join("/"))
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="BA_SUMPAH_${nip}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return new Response("Dokumen tidak ditemukan", { status: 404 })
  }
}
