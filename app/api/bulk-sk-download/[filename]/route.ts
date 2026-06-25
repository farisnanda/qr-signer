import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import path from "path"
import fs from "fs"

export async function GET(
  req: Request,
  { params }: { params: { filename: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const filename = params.filename
  
  // Sanitasi filename — cegah path traversal
  const safeName = path.basename(filename)
  const filePath = path.join("/tmp", safeName)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(filePath)
  const isZip = safeName.endsWith(".zip")
  const contentType = isZip ? "application/zip" : "text/csv"

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Type": contentType,
    },
  })
}