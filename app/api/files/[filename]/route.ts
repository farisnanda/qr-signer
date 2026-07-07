import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"

// Serve signed PDF dari private/uploads secara publik.
// Dipakai oleh halaman verifikasi QR (/verify/[token]) dan proses ZIP di klien.
// Nama file berupa UUID yang tidak bisa ditebak, jadi aman untuk akses publik.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const safeName = path.basename(filename)

  if (!safeName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "File tidak valid" }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), "private/uploads", safeName)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(filePath)

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}
