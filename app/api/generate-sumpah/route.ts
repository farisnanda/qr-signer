import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMinioClient, uploadToMinio, getPresignedUrl } from "@/lib/minio"
import { generateSumpahPdf, getSumpahFilename } from "@/lib/sumpah"
import { getJabatan } from "@/lib/pangkat"
import { read, utils } from "xlsx"
import { v4 as uuid } from "uuid"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const workbook = read(buffer)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json<{ nama: string; nip: string; agama: string; pangkat: string }>(sheet)

  if (rows.length === 0) {
    return Response.json({ error: "Excel kosong" }, { status: 400 })
  }

  const batchId = uuid()
  const batchCode = `SUMPAH_${Date.now()}`
  let successCount = 0
  let errorCount = 0
  const documents: Array<{ namaFile: string; status: string; errorMessage?: string }> = []

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const row of rows) {
          const nama = row.nama?.trim()
          const nip = row.nip?.toString().trim()
          const agama = row.agama?.trim() as "Islam" | "Kristen" | "Budha" | "Hindu" | "Katolik" | undefined
          const pangkat = row.pangkat?.trim()

          if (!nama || !nip || !agama || !pangkat) {
            errorCount++
            documents.push({
              namaFile: nip || "UNKNOWN",
              status: "error",
              errorMessage: "Data tidak lengkap",
            })
            continue
          }

          try {
            const jabatan = getJabatan(pangkat)
            const pdfBuffer = await generateSumpahPdf({
              nama,
              nip,
              jabatan,
              agama,
            })

            const filename = getSumpahFilename(nip)
            await uploadToMinio("sumpah", filename, pdfBuffer, {
              "Content-Type": "application/pdf",
              "Original-Filename": filename,
            })

            const presignedUrl = await getPresignedUrl("sumpah", filename)

            await prisma.document.create({
              data: {
                batchId,
                namaFile: nama,
                nip,
                filePath: presignedUrl,
                status: "success",
              },
            })

            successCount++
            documents.push({
              namaFile: filename,
              status: "success",
            })

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "progress", processed: successCount + errorCount, total: rows.length })}\n\n`)
            )
          } catch (err) {
            errorCount++
            const errorMsg = err instanceof Error ? err.message : "Unknown error"
            documents.push({
              namaFile: nip,
              status: "error",
              errorMessage: errorMsg,
            })
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "progress", processed: successCount + errorCount, total: rows.length, error: errorMsg })}\n\n`)
            )
          }
        }

        await prisma.signBatch.create({
          data: {
            id: batchId,
            batchCode,
            jenisSk: "SUMPAH",
            total: rows.length,
            successCount,
            errorCount,
            signedBy: session.user.email!,
          },
        })

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "complete", successCount, errorCount, total: rows.length })}\n\n`)
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: errorMsg })}\n\n`)
        )
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
