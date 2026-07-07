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
import { checkUserStatusV2, signPdfV2 } from "@/lib/bsre"
import { publicVerifyUrl } from "@/lib/urls"

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

// Prefix penamaan file output SK (terlepas dari golongan template): SK_PNS_<DDMMYYYY>.
const SK_PREFIX = "SK_PNS"

// Template SK CPNS tersimpan di server (templates/*.docx, ikut di-commit & ter-build
// ke image) dan dipilih berdasarkan golongan. Read-only — tidak diubah proses generate.
const TEMPLATE_MAP: Record<string, { file: string; label: string }> = {
  IIa: { file: "IIa.docx", label: "SK_CPNS_IIa" },
  IIc: { file: "IIc.docx", label: "SK_CPNS_IIc" },
  IIIab: { file: "IIIab.docx", label: "SK_CPNS_IIIab" },
  Profesi: { file: "Profesi.docx", label: "SK_CPNS_Profesi" },
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
  const templateKey = (formData.get("templateKey") as string) || ""
  const dateStrInput = (formData.get("dateStr") as string) || ""
  const qrX = Number(formData.get("qrX") || 50)
  const qrY = Number(formData.get("qrY") || 50)
  const qrWidth = Number(formData.get("qrWidth") || 120)
  const qrHeight = Number(formData.get("qrHeight") || 120)
  const pageNumber = Number(formData.get("pageNumber") || 1)
  const pdfScale = Number(formData.get("pdfScale") || 1)
  const canvasHeight = Number(formData.get("canvasHeight") || 800)
  const useQr = formData.get("useQr") === "true"
  const singlePage = formData.get("singlePage") === "true"

  // Parameter TTE (BSrE v2). Kredensial bersifat transien — tidak disimpan/di-log.
  const useTte = formData.get("useTte") === "true"
  const bsreUsername = (formData.get("bsreUsername") as string) || ""
  const bsrePassword = (formData.get("bsrePassword") as string) || ""
  const nik = (formData.get("nik") as string) || ""
  const passphrase = (formData.get("passphrase") as string) || ""
  const chunkSize = Math.min(Math.max(Number(formData.get("chunkSize") || 100), 1), 1000)
  const bsreBaseUrl = process.env.BSRE_BASE_URL || ""

  const template = TEMPLATE_MAP[templateKey]
  if (!excelFile || !template) {
    return new Response(JSON.stringify({ error: "File Excel dan pilihan template golongan wajib diisi" }), { status: 400 })
  }
  if (useTte && (!bsreUsername || !bsrePassword || !nik || !passphrase)) {
    return new Response(JSON.stringify({ error: "Kredensial TTE (username, password, NIK, passphrase) wajib diisi" }), { status: 400 })
  }
  if (useTte && !bsreBaseUrl) {
    return new Response(JSON.stringify({ error: "BSRE_BASE_URL belum dikonfigurasi di server" }), { status: 500 })
  }
  const jenisSk = template.label

  // Tanggal SK diinput manual (mendukung SK mundur). Fallback ke hari ini jika kosong/invalid.
  const templatePath = path.join(process.cwd(), "templates", template.file)
  const nowDate = new Date()
  const dateStr = /^\d{8}$/.test(dateStrInput)
    ? dateStrInput
    : `${String(nowDate.getDate()).padStart(2, "0")}${String(nowDate.getMonth() + 1).padStart(2, "0")}${nowDate.getFullYear()}`

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

        const templateBuffer = fs.readFileSync(templatePath)

        const uploadsDir = path.join(process.cwd(), "private/uploads")
        const outputDir = path.join(uploadsDir, "bulk_sk")
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

        const batchId = uuidv4()
        const batchDir = path.join(outputDir, batchId)
        fs.mkdirSync(batchDir, { recursive: true })

        const total = rows.length

        // Pre-check sertifikat penandatangan sebelum memproses seluruh batch.
        if (useTte) {
          send({ type: "status", message: "Memeriksa status sertifikat penandatangan..." })
          const chk = await checkUserStatusV2({ baseUrl: bsreBaseUrl, username: bsreUsername, password: bsrePassword, nik })
          if (!chk.ok) {
            send({ type: "error", error: `Pre-check BSrE gagal: ${chk.error}` })
            return
          }
          if (chk.active === false) {
            send({ type: "error", error: `Sertifikat penandatangan tidak dapat dipakai: ${chk.message || chk.statusText || "tidak aktif"}` })
            return
          }
        }

        send({ type: "start", total, tte: useTte })

        // Metadata per dokumen; sumber tunggal untuk hasil, ZIP, verifikasi, dan laporan.
        type DocMeta = {
          no: number
          nip: string
          nama: string
          fileName: string
          verifyToken: string | null
          documentNo: string
          title: string
          ok: boolean
          error?: string
        }
        const docMetas: DocMeta[] = []

        const BATCH_SIZE = 6
        let genProcessed = 0

        // FASE 1 — Generate PDF dari template (+ QR verifikasi milik kita).
        async function generateRow(row: any, rowIndex: number) {
          const parsed = getRowData(row, jenisSk)
          if (!parsed) return

          const { nip, nama, data } = parsed
          const fileName = `${SK_PREFIX}_${dateStr}_${nip}.pdf`

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
            const verifyToken = useQr ? uuidv4() : null

            if (useQr && verifyToken) {
              const verifyUrl = publicVerifyUrl(verifyToken)
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

            await writeFile(path.join(batchDir, fileName), finalPdf)
            docMetas.push({
              no: rowIndex + 1, nip, nama, fileName, verifyToken,
              documentNo: data.nomor_sk || nip, title: `${jenisSk} - ${nama}`, ok: true,
            })
            genProcessed++
            send({ type: "progress", phase: "generate", processed: genProcessed, total, nip, nama, status: "success", fileName })

          } catch (err: any) {
            console.error(`[GENERATE FAILED] NIP: ${nip} | Nama: ${nama} | Error: ${err?.message}`)
            docMetas.push({
              no: rowIndex + 1, nip, nama, fileName, verifyToken: null,
              documentNo: nip, title: `${jenisSk} - ${nama}`, ok: false, error: err?.message || "Gagal generate",
            })
            genProcessed++
            send({ type: "progress", phase: "generate", processed: genProcessed, total, nip, nama, status: "error", error: err?.message || "Gagal" })
          }
        }

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE)
          await Promise.all(batch.map((row, idx) => generateRow(row, i + idx)))
        }

        // FASE 2 — TTE via BSrE (invisible), per-chunk dengan satu passphrase.
        if (useTte) {
          const okDocs = docMetas.filter(d => d.ok)
          let signProcessed = 0
          send({ type: "status", message: "Menandatangani dokumen via BSrE..." })

          for (let i = 0; i < okDocs.length; i += chunkSize) {
            const chunk = okDocs.slice(i, i + chunkSize)
            const files = chunk.map(d => fs.readFileSync(path.join(batchDir, d.fileName)).toString("base64"))

            const result = await signPdfV2({
              baseUrl: bsreBaseUrl, username: bsreUsername, password: bsrePassword,
              nik, passphrase, files,
              signatureProperties: [{ tampilan: "INVISIBLE" }],
            })

            chunk.forEach((d, idx) => {
              if (!result.ok) {
                d.ok = false
                d.error = `TTE gagal: ${result.error}`
              } else {
                const signedB64 = result.signed[idx]
                if (!signedB64) {
                  d.ok = false
                  d.error = "TTE: file hasil tidak ditemukan pada response BSrE"
                } else {
                  fs.writeFileSync(path.join(batchDir, d.fileName), Buffer.from(signedB64, "base64"))
                }
              }
              signProcessed++
              send({
                type: "progress", phase: "sign", processed: signProcessed, total: okDocs.length,
                nip: d.nip, nama: d.nama, status: d.ok ? "success" : "error", fileName: d.ok ? d.fileName : undefined, error: d.error,
              })
            })
          }
        }

        // FASE 3 — Finalisasi: salinan verifikasi + record Document (pakai file final/tertandatangani).
        const verifyDocs = docMetas.filter(d => d.ok && d.verifyToken)
        for (const d of verifyDocs) {
          fs.copyFileSync(path.join(batchDir, d.fileName), path.join(uploadsDir, `${d.verifyToken}.pdf`))
        }
        if (verifyDocs.length > 0) {
          try {
            await prisma.document.createMany({
              data: verifyDocs.map(d => ({
                title: d.title,
                documentNo: d.documentNo,
                filePath: `/api/files/${d.verifyToken}.pdf`,
                verifyToken: d.verifyToken!,
              })),
            })
          } catch (docErr: any) {
            console.error("[DOCUMENT CREATE ERROR]", docErr?.message)
          }
        }

        const allResults: ResultItem[] = docMetas.map(d => ({
          no: d.no, nip: d.nip, nama: d.nama,
          status: d.ok ? "Berhasil" : "Gagal",
          fileName: d.ok ? d.fileName : undefined,
          error: d.ok ? undefined : (d.error || "Gagal"),
        }))
        const successCount = allResults.filter(r => r.status === "Berhasil").length
        const errorCount = allResults.length - successCount

        // Buat ZIP — hanya dokumen yang benar-benar berhasil (dan tertandatangani jika TTE).
        const zipFileName = `${SK_PREFIX}_${dateStr}_${batchId.slice(0, 8)}.zip`
        const zipFilePath = path.join(outputDir, zipFileName)
        const admZip = new AdmZip()
        for (const d of docMetas) {
          if (d.ok) admZip.addLocalFile(path.join(batchDir, d.fileName))
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

        const reportFileName = `LAPORAN_${SK_PREFIX}_${dateStr}_${batchId.slice(0, 8)}.xlsx`
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