import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import AdmZip from "adm-zip"
import { prisma } from "@/lib/prisma"
import { requireAdminRole, isSuperAdmin } from "@/lib/security"

const JENIS_SPMT = "SPMT 2026"

// Download dokumen yang SUDAH JADI dari batch yang masih "processing" (belum difinalisasi —
// misal proses terputus di tengah karena koneksi putus / batch besar). Beda dengan
// /api/bulk-sk-download yang cuma bisa ambil zip hasil batch yang sudah selesai.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await requireAdminRole()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { batchId } = await params
  const safeId = path.basename(batchId) // cegah path traversal

  const batch = await prisma.signBatch.findFirst({
    where: { batchCode: safeId, jenisSk: JENIS_SPMT },
    select: { signedBy: true, status: true },
  })

  if (!batch) {
    return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 })
  }
  if (!isSuperAdmin(session as any) && batch.signedBy !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (batch.status === "done") {
    return NextResponse.json({ error: "Batch ini sudah selesai — pakai tombol download ZIP biasa, bukan yang parsial" }, { status: 400 })
  }

  const batchDir = path.join(process.cwd(), "private/uploads/bulk_sk", safeId)
  if (!fs.existsSync(batchDir)) {
    return NextResponse.json({ error: "Folder dokumen batch ini sudah tidak ada di server" }, { status: 404 })
  }

  const files = fs.readdirSync(batchDir).filter(f => f.toLowerCase().endsWith(".pdf"))
  if (files.length === 0) {
    return NextResponse.json({ error: "Belum ada dokumen yang jadi di batch ini" }, { status: 404 })
  }

  const admZip = new AdmZip()
  for (const f of files) {
    admZip.addLocalFile(path.join(batchDir, f))
  }
  const buffer = admZip.toBuffer()
  const zipFileName = `PARSIAL_${safeId.slice(0, 8)}_${files.length}dok.zip`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${zipFileName}"`,
      "Content-Type": "application/zip",
    },
  })
}
