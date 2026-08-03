import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"

// Serve signed PDF dari private/uploads secara publik.
// Dipakai oleh halaman verifikasi QR (/verify/[token]) dan proses ZIP di klien.
// Nama file berupa UUID yang tidak bisa ditebak, jadi aman untuk akses publik.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const safeName = path.basename(filename)
  const token = new URL(req.url).searchParams.get("token")

  if (!safeName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "File tidak valid" }, { status: 400 })
  }

  let allowed = false
  if (token) {
    const document = await prisma.document.findFirst({
      where: {
        verifyToken: token,
        filePath: { contains: safeName },
      },
      select: { id: true },
    })
    allowed = Boolean(document)
  }

  if (!allowed) {
    const session = await requireAdminRole()
    allowed = Boolean(session)
  }

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
