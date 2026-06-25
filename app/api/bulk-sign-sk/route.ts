import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { headers } from "next/headers"
import { writeFile } from "fs/promises"
import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import sharp from "sharp"
import { PDFDocument } from "pdf-lib"
import QRCode from "qrcode"
import * as XLSX from "xlsx"
import PizZip from "pizzip"
import AdmZip from "adm-zip"
import { prisma } from "@/lib/prisma"

const GAJI_PNS_MAP: Record<string, number> = {
  "II/a": 2218400,
  "II/b": 2463700,
  "II/c": 2485900,
  "II/d": 2633200,
  "III/a": 2785700,
  "III/b": 2903600,
  "III/c": 3026400,
  "III/d": 3154900,
}

const PANGKAT_MAP: Record<string, string> = {
  "II/a": "Pengatur Muda",
  "II/b": "Pengatur Muda Tk.I",
  "II/c": "Pengatur",
  "II/d": "Pengatur Tk.I",
  "III/a": "Penata Muda",
  "III/b": "Penata Muda Tk.I",
  "III/c": "Penata",
  "III/d": "Penata Tk.I",
}

const NOMOR_SK_MAP: Record<string, string> = {
  "II/a": "1879",
  "II/c": "1880",
  "III/a": "1881",
  "III/b": "1882",
  "III/c": "1884",
}

function formatRupiah(nominal: number): string {
  return nominal.toLocaleString("id-ID")
}

function formatTanggal(tgl: string): string {
  if (!tgl) return ""
  const str = tgl.toString().trim()
  if (/^\d{5}$/.test(str)) {
    const date = new Date((parseInt(str) - 25569) * 86400 * 1000)
    const d = String(date.getUTCDate()).padStart(2, "0")
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const y = date.getUTCFullYear()
    return `${d}-${m}-${y}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split("-")
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return str
}

async function convertDocxToPdf(docxBuffer: Buffer, fileName: string): Promise<Buffer> {
  const gotenbergUrl = process.env.GOTENBERG_URL || "http://localhost:3001"
  const arrayBuffer = docxBuffer.buffer.slice(
    docxBuffer.byteOffset,
    docxBuffer.byteOffset + docxBuffer.byteLength
  ) as ArrayBuffer
  const form = new FormData()
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  })
  form.append("files", blob, fileName)
  const res = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gotenberg error: ${res.status} - ${errText}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function injectQrToPdf(
  pdfBuffer: Buffer,
  verifyUrl: string,
  qrX: number,
  qrY: number,
  qrWidth: number,
  qrHeight: number,
  pageNumber: number,
  pdfScale: number,
  canvasHeight: number
): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 500,
  })
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64")
  const logoPath = path.join(process.cwd(), "public/logo.png")
  const logoBuffer = await sharp(fs.readFileSync(logoPath)).resize(120, 120).png().toBuffer()
  const qrImageBytes = await sharp(qrBuffer).ensureAlpha().composite([{ input: logoBuffer, gravity: "center" }]).png().toBuffer()
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const pages = pdfDoc.getPages()
  const selectedPage = pages[(pageNumber || 1) - 1] || pages[0]
  const qrPng = await pdfDoc.embedPng(qrImageBytes)
  const pdfHeight = selectedPage.getHeight()
  const finalX = qrX / pdfScale
  const finalWidth = qrWidth / pdfScale
  const finalHeight = qrHeight / pdfScale
  const finalY = pdfHeight - (qrY * pdfHeight / canvasHeight) - finalHeight
  selectedPage.drawImage(qrPng, { x: finalX, y: finalY, width: finalWidth, height: finalHeight })
  return Buffer.from(await pdfDoc.save())
}

function getRowData(row: any, jenisSk: string): { nip: string; nama: string; data: Record<string, string> } | null {
  if (jenisSk === "SK_JABATAN") {
    const nip = String(row["nip"] || "").trim()
    const nama = String(row["nama"] || "").trim()
    if (!nip || !nama) return null
    const data: Record<string, string> = {
      nama,
      nip,
      golongan_ruang: String(row["pangkat/Golongan"] || "").trim(),
      jabatan: String(row["nama_jabatan"] || "").trim(),
      unor: String(row["UNOR"] || "").trim(),
    }
    return { nip, nama, data }
  }

  const nip = String(row["NIP BARU"] || "").trim()
  const nama = String(row["NAMA"] || "").trim()
  if (!nip || !nama) return null

  const golongan = String(row["GOL. RUANG"] || "").trim()
  const gajiPnsNum = GAJI_PNS_MAP[golongan] || 0
  const gajiCpnsNum = Math.round(gajiPnsNum * 0.8)
  const pangkat = PANGKAT_MAP[golongan] || golongan
  const nomorSk = NOMOR_SK_MAP[golongan] || "1879"
  const golonganRuang = `${pangkat} (${golongan})`

  const data: Record<string, string> = {
    nomor_sk: nomorSk,
    nama,
    nip,
    tempat_lahir: String(row["TEMPAT LAHIR"] || "").trim(),
    tanggal_lahir: formatTanggal(String(row["TGL LAHIR"] || "").trim()),
    jenis_kelamin: String(row["JENIS KELAMIN"] || "").trim().toLowerCase().includes("laki") ? "Laki-laki" : "Perempuan",
    jenjang: String(row["JENJANG"] || "").trim(),
    prodi: String(row["PRODI"] || "").trim(),
    tahun_lulus: String(row["THN LULUS"] || "").trim(),
    tmt_cpns: formatTanggal(String(row["TMT CPNS"] || "").trim()),
    golongan,
    gaji_cpns: formatRupiah(gajiCpnsNum),
    jabatan: String(row["NAMA JABATAN"] || "").trim(),
    masa_kerja: String(row["MASA KERJA"] || "").trim(),
    unor: String(row["SKPD"] || "").trim(),
    nomor_surat_dokter: String(row["NO SURAT SEHAT"] || "").trim(),
    tanggal_surat_dokter: formatTanggal(String(row["TGL SURAT SEHAT"] || "").trim()),
    nomor_surat_latsar: String(row["NO SURAT LATSAR"] || "").trim(),
    tanggal_surat_latsar: formatTanggal(String(row["TGL SURAT LATSAR"] || "").trim()),
    gaji_pns: formatRupiah(gajiPnsNum),
    golongan_ruang: golonganRuang,
  }
  return { nip, nama, data }
}

type ResultItem = {
  no: number
  nip: string
  nama: string
  status: string
  fileName?: string
  error?: string
}

export async function POST(req: Request) {
  await headers()
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const formData = await req.formData()
  const excelFile = formData.get("excel") as File
  const templateFile = formData.get("template") as File
  const jenisSk = (formData.get("jenisSk") as string) || "SK_PNS"
  const qrX = Number(formData.get("qrX") || 50)
  const qrY = Number(formData.get("qrY") || 50)
  const qrWidth = Number(formData.get("qrWidth") || 120)
  const qrHeight = Number(formData.get("qrHeight") || 120)
  const pageNumber = Number(formData.get("pageNumber") || 1)
  const pdfScale = Number(formData.get("pdfScale") || 1)
  const canvasHeight = Number(formData.get("canvasHeight") || 800)
  const useQr = formData.get("useQr") === "true"
  const singlePage = formData.get("singlePage") === "true"

  if (!excelFile || !templateFile) {
    return new Response(JSON.stringify({ error: "File Excel dan template wajib diupload" }), { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      try {
        const excelBuffer = Buffer.from(await excelFile.arrayBuffer())
        const workbook = XLSX.read(excelBuffer, { type: "buffer" })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const allRows: any[] = XLSX.utils.sheet_to_json(sheet)

        const rows = allRows.filter(r => {
          if (jenisSk === "SK_JABATAN") {
            return String(r["nip"] || "").trim() && String(r["nama"] || "").trim()
          }
          return String(r["NIP BARU"] || "").trim() && String(r["NAMA"] || "").trim()
        })

        const templateBuffer = Buffer.from(await templateFile.arrayBuffer())
        const dateStr = "01062026"

        const outputDir = path.join(process.cwd(), "private/uploads/bulk_sk")
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

        const batchId = uuidv4()
        const batchDir = path.join(outputDir, batchId)
        fs.mkdirSync(batchDir, { recursive: true })

        const total = rows.length
        send({ type: "start", total })

        let successCount = 0
        let errorCount = 0
        let processedCount = 0
        const allResults: ResultItem[] = []

        const BATCH_SIZE = 6

        async function processRow(row: any, rowIndex: number) {
          const parsed = getRowData(row, jenisSk)
          if (!parsed) return

          const { nip, nama, data } = parsed

          try {
            const zip = new PizZip(templateBuffer)
            let documentXml = zip.file("word/document.xml")!.asText()
            for (const [key, value] of Object.entries(data)) {
              const safeValue = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              documentXml = documentXml.split(`{${key}}`).join(safeValue)
            }
            zip.file("word/document.xml", documentXml)
            const docxBuffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" })

            const pdfBuffer = await convertDocxToPdf(docxBuffer, `${nip}.docx`)
            let finalPdf: Buffer

            if (useQr) {
              const verifyUrl = `${process.env.NEXTAUTH_URL}/verify/${uuidv4()}`
              finalPdf = await injectQrToPdf(pdfBuffer, verifyUrl, qrX, qrY, qrWidth, qrHeight, pageNumber, pdfScale, canvasHeight)
            } else {
              finalPdf = pdfBuffer
            }

            if (singlePage) {
              const pdfCheck = await PDFDocument.load(finalPdf)
              if (pdfCheck.getPageCount() > 1) {
                const singleDoc = await PDFDocument.create()
                const [firstPage] = await singleDoc.copyPages(pdfCheck, [0])
                singleDoc.addPage(firstPage)
                finalPdf = Buffer.from(await singleDoc.save())
              }
            }

            const fileName = `${jenisSk}_${dateStr}_${nip}.pdf`
            await writeFile(path.join(batchDir, fileName), finalPdf)

            successCount++
            processedCount++
            allResults.push({ no: rowIndex + 1, nip, nama, status: "Berhasil", fileName })
            send({ type: "progress", processed: processedCount, total, nip, nama, status: "success", fileName })

          } catch (err: any) {
            // Log gagal ke server console
            console.error(`[SIGN FAILED] NIP: ${nip} | Nama: ${nama} | Error: ${err?.message}`)

            errorCount++
            processedCount++
            allResults.push({ no: rowIndex + 1, nip, nama, status: "Gagal", error: err?.message || "Gagal" })
            send({ type: "progress", processed: processedCount, total, nip, nama, status: "error", error: err?.message || "Gagal" })
          }
        }

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE)
          await Promise.all(batch.map((row, idx) => processRow(row, i + idx)))
        }

        // Buat ZIP
        const zipFileName = `${jenisSk}_${dateStr}_${batchId.slice(0, 8)}.zip`
        const zipFilePath = path.join(outputDir, zipFileName)
        const admZip = new AdmZip()
        const pdfFiles = fs.readdirSync(batchDir).filter(f => f.endsWith(".pdf"))
        for (const pdfFile of pdfFiles) {
          admZip.addLocalFile(path.join(batchDir, pdfFile))
        }
        admZip.writeZip(zipFilePath)
        fs.rmSync(batchDir, { recursive: true, force: true })

        // Buat laporan Excel
        const reportwb = XLSX.utils.book_new()
        const summaryData = [
          ["Laporan Generate SK Massal"],
          ["Jenis SK", jenisSk],
          ["Tanggal Proses", new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })],
          ["Total Dokumen", total],
          ["Berhasil", successCount],
          ["Gagal", errorCount],
          [],
        ]
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(reportwb, summarySheet, "Ringkasan")

        const detailHeaders = ["No", "NIP", "Nama", "Status", "Nama File / Keterangan Error"]
        const detailRows = allResults
          .sort((a, b) => a.no - b.no)
          .map(r => [
            r.no, r.nip, r.nama, r.status,
            r.status === "Berhasil" ? (r.fileName || "") : (r.error || "Gagal"),
          ])
        const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows])
        detailSheet["!cols"] = [
          { wch: 5 }, { wch: 22 }, { wch: 40 }, { wch: 10 }, { wch: 50 },
        ]
        XLSX.utils.book_append_sheet(reportwb, detailSheet, "Detail")

        const reportFileName = `LAPORAN_${jenisSk}_${dateStr}_${batchId.slice(0, 8)}.xlsx`
        const reportFilePath = path.join(outputDir, reportFileName)
        const reportBuffer = XLSX.write(reportwb, { type: "buffer", bookType: "xlsx" })
        await writeFile(reportFilePath, reportBuffer)

        // Simpan ke DB
        try {
          const batchRecord = await prisma.signBatch.create({
            data: {
              batchCode: batchId.slice(0, 8).toUpperCase(),
              jenisSk,
              total,
              successCount,
              errorCount,
              zipFileName,
              reportFileName,
              signedBy: session.user.email!,
            },
          })

          await prisma.signLog.createMany({
            data: allResults.map(r => ({
              batchId: batchRecord.id,
              jenisSk,
              namaFile: r.fileName ?? null,
              nip: r.nip,
              nama: r.nama,
              status: r.status === "Berhasil" ? "success" : "error",
              errorMessage: r.error ?? null,
              signedBy: session.user.email!,
            })),
          })

          console.log(`[SIGN BATCH] ${batchRecord.batchCode} | ${jenisSk} | Total: ${total} | Berhasil: ${successCount} | Gagal: ${errorCount} | By: ${session.user.email}`)
        } catch (dbErr: any) {
          console.error("[DB LOG ERROR]", dbErr?.message)
        }

        send({
          type: "done",
          total,
          successCount,
          errorCount,
          downloadUrl: `/qr-signer/api/bulk-sk-download/${zipFileName}`,
          reportUrl: `/qr-signer/api/bulk-sk-download/${reportFileName}`,
        })

      } catch (err: any) {
        console.error("[BULK SIGN ERROR]", err?.message)
        send({ type: "error", error: err?.message || "Gagal" })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}