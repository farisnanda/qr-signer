import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const safeName = path.basename(filename)

  if (!safeName.endsWith(".zip") && !safeName.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), "private/uploads/bulk_sk", safeName)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(filePath)
  const isZip = safeName.endsWith(".zip")
  const contentType = isZip
    ? "application/zip"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Type": contentType,
    },
  })
}
