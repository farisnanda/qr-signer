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
  // dateStr: DDMMYYYY untuk penamaan file (fallback ke hari ini di getSumpahFilename)
  const dateStr = (formData.get("dateStr") as string) || ""
  // singlePage default true (samakan dengan bulk-sign-sk)
  const singlePage = formData.get("singlePage") !== "false"

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

  // Create batch record FIRST before processing rows
  await prisma.signBatch.create({
    data: {
      id: batchId,
      batchCode,
      jenisSk: "SUMPAH",
      total: rows.length,
      successCount: 0,
      errorCount: 0,
      signedBy: session.user.email!,
    },
  })

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
            const pdfBuffer = await generateSumpahPdf(
              { nama, nip, jabatan, agama },
              { singlePage }
            )

            const filename = getSumpahFilename(nip, dateStr)
            await uploadToMinio("sumpah", filename, pdfBuffer)

            await prisma.signLog.create({
              data: {
                batchId,
                jenisSk: "SUMPAH",
                namaFile: filename,
                nip,
                nama,
                status: "success",
                signedBy: session.user.email!,
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

        // Update batch with final counts
        await prisma.signBatch.update({
          where: { id: batchId },
          data: {
            successCount,
            errorCount,
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
