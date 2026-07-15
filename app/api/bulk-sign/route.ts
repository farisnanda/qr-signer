import { writeFile } from "fs/promises"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { headers } from "next/headers"
import sharp from "sharp"
import fs from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"
import { PDFDocument } from "pdf-lib"
import QRCode from "qrcode"
import { publicVerifyUrl } from "@/lib/urls"
import { signPdfV2 } from "@/lib/bsre"

export async function POST(req: Request) {
  try {
    await headers()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "File PDF tidak valid" }, { status: 400 })
    }

    const qrX = Number(formData.get("qrX"))
    const qrY = Number(formData.get("qrY"))
    const qrWidth = Number(formData.get("qrWidth"))
    const qrHeight = Number(formData.get("qrHeight"))
    const pageNumber = Number(formData.get("pageNumber"))
    const pdfScale = Number(formData.get("pdfScale")) || 1
    const canvasHeight = Number(formData.get("canvasHeight")) || 800
    const batchCode = (formData.get("batchCode") as string) || uuidv4().slice(0, 8).toUpperCase()
    const batchTotal = Number(formData.get("batchTotal") || 1)
    const batchIndex = Number(formData.get("batchIndex") || 0) // 0-based
    const isLastFile = batchIndex === batchTotal - 1

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileName = `${uuidv4()}.pdf`
    const filePath = path.join(process.cwd(), "private/uploads", fileName)

    const verifyToken = uuidv4()
    const verifyUrl = publicVerifyUrl(verifyToken)

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 500,
    })

    const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64")
    const logoPath = path.join(process.cwd(), "public/logo.png")
    const logoBuffer = await sharp(fs.readFileSync(logoPath)).resize(120, 120).png().toBuffer()
    const qrImageBytes = await sharp(qrBuffer).ensureAlpha()
      .composite([{ input: logoBuffer, gravity: "center" }]).png().toBuffer()

    const pdfDoc = await PDFDocument.load(buffer)
    const pages = pdfDoc.getPages()
    const selectedPage = pages[pageNumber - 1] || pages[0]
    const qrPng = await pdfDoc.embedPng(qrImageBytes)

    const pdfHeight = selectedPage.getHeight()
    const finalX = qrX / pdfScale
    const finalWidth = qrWidth / pdfScale
    const finalHeight = qrHeight / pdfScale
    const finalY = pdfHeight - (qrY * pdfHeight / canvasHeight) - finalHeight

    selectedPage.drawImage(qrPng, { x: finalX, y: finalY, width: finalWidth, height: finalHeight })

    const finalPdfBytes = await pdfDoc.save()

    // TTE BSrE (opsional) — tandatangani PDF ber-QR sebelum disimpan.
    let outputBytes: Uint8Array = finalPdfBytes
    const useTte = formData.get("useTte") === "true"
    if (useTte) {
      const bsreBaseUrl = process.env.BSRE_BASE_URL || ""
      const bsreUsername = (formData.get("bsreUsername") as string) || ""
      const bsrePassword = (formData.get("bsrePassword") as string) || ""
      const nik = (formData.get("nik") as string) || ""
      const passphrase = (formData.get("passphrase") as string) || ""
      if (!bsreBaseUrl) {
        return NextResponse.json({ error: "BSRE_BASE_URL belum dikonfigurasi di server" }, { status: 500 })
      }
      if (!bsreUsername || !bsrePassword || !nik || !passphrase) {
        return NextResponse.json({ error: "Kredensial TTE (username, password, NIK, passphrase) wajib diisi" }, { status: 400 })
      }
      const signRes = await signPdfV2({
        baseUrl: bsreBaseUrl, username: bsreUsername, password: bsrePassword,
        nik, passphrase,
        files: [Buffer.from(finalPdfBytes).toString("base64")],
        signatureProperties: [{ tampilan: "INVISIBLE" }],
      })
      if (!signRes.ok || !signRes.signed[0]) {
        return NextResponse.json({ error: `TTE gagal: ${signRes.error || "respons BSrE tidak berisi file"}` }, { status: 502 })
      }
      outputBytes = Buffer.from(signRes.signed[0], "base64")
    }

    await writeFile(filePath, outputBytes)

    const document = await prisma.document.create({
      data: {
        title: file.name.replace(".pdf", ""),
        documentNo: uuidv4(),
        filePath: `/api/files/${fileName}`,
        verifyToken,
        qrX, qrY, qrWidth, qrHeight,
      },
    })

    // Simpan SignLog
    try {
      // Cari atau buat SignBatch
      let batch = await prisma.signBatch.findUnique({
        where: { batchCode },
      })

      if (!batch) {
        batch = await prisma.signBatch.create({
          data: {
            batchCode,
            jenisSk: "BULK_SIGN",
            total: batchTotal,
            successCount: 0,
            errorCount: 0,
            signedBy: session.user.email!,
          },
        })
      }

      // Tambah log
      await prisma.signLog.create({
        data: {
          batchId: batch.id,
          jenisSk: "BULK_SIGN",
          namaFile: file.name,
          status: "success",
          signedBy: session.user.email!,
        },
      })

      // Update successCount
      await prisma.signBatch.update({
        where: { id: batch.id },
        data: { successCount: { increment: 1 } },
      })

    } catch (dbErr: any) {
      console.error("[DB LOG ERROR]", dbErr?.message)
    }

    return NextResponse.json({ success: true, result: document })

  } catch (error: any) {
    console.error("[BULK SIGN ERROR]", error)

    // Simpan log gagal kalau ada session
    try {
      await headers()
      const session = await getServerSession(authOptions)
      const formData = await (req as any).formData?.()
      const batchCode = formData?.get?.("batchCode") as string
      const file = formData?.get?.("file") as File

      if (session?.user && batchCode) {
        const batch = await prisma.signBatch.findUnique({ where: { batchCode } })
        if (batch) {
          await prisma.signLog.create({
            data: {
              batchId: batch.id,
              jenisSk: "BULK_SIGN",
              namaFile: file?.name ?? null,
              status: "error",
              errorMessage: error?.message || "Gagal",
              signedBy: session.user.email!,
            },
          })
          await prisma.signBatch.update({
            where: { id: batch.id },
            data: { errorCount: { increment: 1 } },
          })
        }
      }
    } catch {}

    return NextResponse.json({ error: "Bulk sign failed" }, { status: 500 })
  }
}