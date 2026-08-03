import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { getPresignedUrl } from "@/lib/minio"
import { prisma } from "@/lib/prisma"
import { requireAdminRole, isSuperAdmin } from "@/lib/security"

const MINIO_BUCKET = process.env.MINIO_BUCKET || "qr-signer-sk"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await requireAdminRole()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { filename } = await params

  if (!filename.endsWith(".zip") && !filename.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
  }

  // Deteksi: jika filename berisi "/", anggap Minio object path (format: batch/{batchId}/nama.zip)
  const isMinioPath = filename.includes("/")

  try {
    if (isMinioPath) {
      const batchKey = filename.split("/")[1]
      const batch = batchKey
        ? await prisma.signBatch.findFirst({
            where: {
              OR: [
                { id: batchKey },
                { zipFileName: filename },
                { reportFileName: filename },
              ],
            },
            select: { signedBy: true },
          })
        : null

      if (!batch || (!isSuperAdmin(session) && batch.signedBy !== session.user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      // Minio object — generate presigned URL dan redirect
      const presignedUrl = await getPresignedUrl(MINIO_BUCKET, filename)
      return NextResponse.redirect(presignedUrl, { status: 302 })
    } else {
      // Fallback: filesystem lokal (backward compatibility)
      const safeName = path.basename(filename)
      const batch = await prisma.signBatch.findFirst({
        where: {
          OR: [
            { zipFileName: safeName },
            { reportFileName: safeName },
            { zipFileName: { endsWith: safeName } },
            { reportFileName: { endsWith: safeName } },
          ],
        },
        select: { signedBy: true },
      })

      if (!batch || (!isSuperAdmin(session) && batch.signedBy !== session.user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const filePath = path.join(process.cwd(), "private/uploads/bulk_sk", safeName)

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 })
      }

      const fileBuffer = fs.readFileSync(filePath)
      const contentType = safeName.endsWith(".zip")
        ? "application/zip"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Type": contentType,
        },
      })
    }
  } catch (err: any) {
    console.error(`[DOWNLOAD ERROR] ${filename} | ${err?.message}`)
    return NextResponse.json({ error: err?.message || "Download gagal" }, { status: 500 })
  }
}
