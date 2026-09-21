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
import { uploadToMinio, getPresignedUrl } from "@/lib/minio"
import { requireAdminRole, isSuperAdmin } from "@/lib/security"
import { convertDocxToPdfPooled } from "@/lib/gotenberg-pool"

const MINIO_BUCKET = process.env.MINIO_BUCKET || "qr-signer-sk"

// Label jenis dokumen — dipakai sebagai jenisSk (SignBatch/SignLog) dan prefix nama file.
// Nomor surat SPMT hardcode tahun 2026 di template (mengikuti pola tahunan SK CPNS);
// tahun berikutnya butuh template + label baru.
const JENIS_SPMT = "SPMT 2026"
const FILE_PREFIX = "SPMT_2026"

const TEMPLATE_FILE = "SPMT_PPPK_PW.docx"

function formatTanggalIndo(isoDate: string): string {
  if (!isoDate) return ""
  const d = new Date(isoDate + "T00:00:00")
  if (isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

function formatTanggalFile(isoDate: string): string {
  if (!isoDate) return ""
  const d = new Date(isoDate + "T00:00:00")
  if (isNaN(d.getTime())) return isoDate.replace(/-/g, "")
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}${mm}${d.getFullYear()}`
}

const convertDocxToPdf = convertDocxToPdfPooled

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

type BatchInfo = {
  nomorSuratAwal: number
  nomorSkPengangkatan: string
  tanggalSkPengangkatan: string // sudah format Indo, sama utk semua baris
  tanggalMulaiTugas: string
  tanggalSurat: string
}

// Baris Excel (header persis file "DATA SPMT-PK PPPK PARUH WAKTU"):
// No | Nomor Peserta | NIP | Jenis | Nama Lengkap | Gelar Depan | Gelar Belakang |
// Tempat Lahir | Upah | Tanggal Lahir | Jabatan | Pendidikan | Unit Kerja PK-SPMT |
// Unit Kerja SIASN | Keterangan
// Gabungkan gelar depan + nama + gelar belakang jadi satu string presisi:
// - gelar depan kosong -> tanpa spasi nyangkut di depan
// - koma pemisah gelar belakang cuma ditambah kalau gelar belakang ada isinya
// - buang koma/spasi yang mungkin sudah kebawa dari data Excel biar ga dobel
function formatNamaGelar(gelarDepan: string, namaLengkap: string, gelarBelakang: string): string {
  const depan = gelarDepan.trim()
  const nama = namaLengkap.trim()
  const belakang = gelarBelakang.trim().replace(/^,\s*/, "")
  const parts = [depan, nama].filter(Boolean)
  let result = parts.join(" ")
  if (belakang) result += `, ${belakang}`
  return result
}

function getRowData(row: any, rowOrderIndex: number, batch: BatchInfo): { nip: string; nama: string; data: Record<string, string> } | null {
  const nip = String(row["NIP"] || "").trim()
  const namaLengkap = String(row["Nama Lengkap"] || "").trim()
  if (!nip || !namaLengkap) return null

  const gelarDepan = String(row["Gelar Depan"] || "").trim()
  const gelarBelakang = String(row["Gelar Belakang"] || "").trim()
  const nomorSurat = String(batch.nomorSuratAwal) // satu nomor sama utk semua peserta di batch ini

  const data: Record<string, string> = {
    gelar_depan: gelarDepan,
    nama_lengkap: namaLengkap,
    gelar_belakang: gelarBelakang,
    nama_lengkap_gelar: formatNamaGelar(gelarDepan, namaLengkap, gelarBelakang),
    nip,
    pendidikan: String(row["Pendidikan"] || "").trim(),
    jabatan: String(row["Jabatan"] || "").trim(),
    unit_kerja_pkspmt: String(row["Unit Kerja PK-SPMT"] || "").trim(),
    nomor_surat: nomorSurat,
    nomor_sk_pengangkatan: batch.nomorSkPengangkatan,
    tanggal_sk_pengangkatan: batch.tanggalSkPengangkatan,
    tanggal_mulai_tugas: batch.tanggalMulaiTugas,
    tanggal_surat: batch.tanggalSurat,
  }

  const namaTampil = [gelarDepan, namaLengkap, gelarBelakang].filter(Boolean).join(" ")
  return { nip, nama: namaTampil, data }
}

function renderDocx(templateBuffer: Buffer, data: Record<string, string>): Buffer {
  const zip = new PizZip(templateBuffer)
  let documentXml = zip.file("word/document.xml")!.asText()
  for (const [key, value] of Object.entries(data)) {
    const safeValue = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    documentXml = documentXml.split(`{${key}}`).join(safeValue)
  }
  zip.file("word/document.xml", documentXml)
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" })
}

// ---- Manifest resume ----
// Ditulis ke <batchDir>/_manifest.json, dipakai buat tahu dokumen mana yang sudah kelar
// kalau proses terputus (koneksi putus, server restart, dst) dan admin klik "Lanjutkan".
// phase "generated" = PDF sudah jadi tapi (kalau TTE aktif) belum ditandatangani.
// phase "signed"    = sudah final (sudah TTE, atau TTE memang tidak dipakai).
type ManifestEntry = {
  fileName: string
  nama: string
  documentNo: string
  verifyToken: string | null
  phase: "generated" | "signed"
}
type Manifest = Record<string, ManifestEntry> // key = NIP

function manifestPath(batchDir: string) {
  return path.join(batchDir, "_manifest.json")
}

function readManifest(batchDir: string): Manifest {
  try {
    const raw = fs.readFileSync(manifestPath(batchDir), "utf-8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeManifest(batchDir: string, manifest: Manifest) {
  try {
    const p = manifestPath(batchDir)
    const tmp = `${p}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(manifest))
    fs.renameSync(tmp, p) // atomic, hindari file manifest korup kalau proses mati di tengah nulis
  } catch (err: any) {
    console.error("[SPMT MANIFEST WRITE ERROR]", err?.message)
  }
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
  const session = await requireAdminRole(["SUPERADMIN", "ADMIN", "BIDANG", "PENGIRIM"])
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const formData = await req.formData()
  const mode = ((formData.get("mode") as string) || "full") as "check" | "full" | "resume"
  const excelFile = formData.get("excel") as File
  const resumeBatchId = ((formData.get("batchId") as string) || "").trim()

  const nomorSuratAwal = parseInt((formData.get("nomorSuratAwal") as string) || "", 10)
  const nomorSkPengangkatan = ((formData.get("nomorSkPengangkatan") as string) || "").trim()
  const tanggalSkPengangkatanRaw = (formData.get("tanggalSkPengangkatan") as string) || ""
  const tanggalMulaiTugasRaw = (formData.get("tanggalMulaiTugas") as string) || ""
  const tanggalSuratRaw = (formData.get("tanggalSurat") as string) || ""

  const qrX = Number(formData.get("qrX") || 50)
  const qrY = Number(formData.get("qrY") || 50)
  const qrWidth = Number(formData.get("qrWidth") || 120)
  const qrHeight = Number(formData.get("qrHeight") || 120)
  const pageNumber = Number(formData.get("pageNumber") || 1)
  const pdfScale = Number(formData.get("pdfScale") || 1)
  const canvasHeight = Number(formData.get("canvasHeight") || 800)
  const useQr = formData.get("useQr") === "true"

  const useTte = formData.get("useTte") === "true"
  const bsreUsername = (formData.get("bsreUsername") as string) || ""
  const bsrePassword = (formData.get("bsrePassword") as string) || ""
  const nik = (formData.get("nik") as string) || ""
  const passphrase = (formData.get("passphrase") as string) || ""
  const chunkSize = Math.min(Math.max(Number(formData.get("chunkSize") || 100), 1), 1000)
  const bsreBaseUrl = process.env.BSRE_BASE_URL || ""

  if (!excelFile) {
    return new Response(JSON.stringify({ error: "File Excel wajib diupload" }), { status: 400 })
  }
  if (!nomorSuratAwal || !nomorSkPengangkatan || !tanggalSkPengangkatanRaw || !tanggalMulaiTugasRaw || !tanggalSuratRaw) {
    return new Response(JSON.stringify({ error: "Nomor surat, nomor & tanggal SK pengangkatan, tanggal mulai tugas, dan tanggal surat wajib diisi" }), { status: 400 })
  }
  if (mode === "resume" && !resumeBatchId) {
    return new Response(JSON.stringify({ error: "batchId wajib diisi untuk melanjutkan proses" }), { status: 400 })
  }
  if (mode !== "check" && useTte && (!bsreUsername || !bsrePassword || !nik || !passphrase)) {
    return new Response(JSON.stringify({ error: "Kredensial TTE (username, password, NIK, passphrase) wajib diisi" }), { status: 400 })
  }
  if (mode !== "check" && useTte && !bsreBaseUrl) {
    return new Response(JSON.stringify({ error: "BSRE_BASE_URL belum dikonfigurasi di server" }), { status: 500 })
  }

  const batch: BatchInfo = {
    nomorSuratAwal,
    nomorSkPengangkatan,
    tanggalSkPengangkatan: formatTanggalIndo(tanggalSkPengangkatanRaw),
    tanggalMulaiTugas: formatTanggalIndo(tanggalMulaiTugasRaw),
    tanggalSurat: formatTanggalIndo(tanggalSuratRaw),
  }

  const templatePath = path.join(process.cwd(), "templates", TEMPLATE_FILE)
  const templateBuffer = fs.readFileSync(templatePath)
  const dateStr = formatTanggalFile(tanggalSuratRaw)

  const excelBuffer = Buffer.from(await excelFile.arrayBuffer())
  const workbook = XLSX.read(excelBuffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const allRows: any[] = XLSX.utils.sheet_to_json(sheet)
  const rows = allRows.filter(r => String(r["NIP"] || "").trim() && String(r["Nama Lengkap"] || "").trim())

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada baris data valid di Excel (kolom NIP / Nama Lengkap kosong semua)" }), { status: 400 })
  }

  // MODE CHECK — generate 1 dokumen (peserta baris pertama) buat dicek datanya sebelum produksi massal.
  // Tidak simpan ke DB/Minio, tidak TTE — murni preview render dari template.
  if (mode === "check") {
    const parsed = getRowData(rows[0], 0, batch)
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Baris pertama tidak valid (NIP/Nama Lengkap kosong)" }), { status: 400 })
    }
    try {
      const docxBuffer = renderDocx(templateBuffer, parsed.data)
      const pdfBuffer = await convertDocxToPdf(docxBuffer, `${parsed.nip}.docx`)
      let finalPdf = pdfBuffer
      if (useQr) {
        finalPdf = await injectQrToPdf(pdfBuffer, publicVerifyUrl(uuidv4()), qrX, qrY, qrWidth, qrHeight, pageNumber, pdfScale, canvasHeight)
      }
      return new Response(new Uint8Array(finalPdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="CEK_${FILE_PREFIX}_${parsed.nip}.pdf"`,
        },
      })
    } catch (err: any) {
      console.error("[SPMT CHECK ERROR]", err?.message)
      return new Response(JSON.stringify({ error: err?.message || "Gagal generate dokumen cek" }), { status: 500 })
    }
  }

  // MODE FULL / RESUME — produksi baris, streaming progress via SSE.
  // Batch folder + manifest TIDAK dihapus sampai finalisasi (zip+upload) sukses, jadi kalau
  // koneksi putus di tengah jalan, dokumen yang sudah jadi tetap ada di server dan bisa
  // dilanjutkan (mode=resume) atau diunduh apa adanya (lihat /api/bulk-sign-spmt/partial/[batchId]).
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      try {
        const uploadsDir = path.join(process.cwd(), "private/uploads")
        const outputDir = path.join(uploadsDir, "bulk_sk")
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

        let batchId: string
        let batchDir: string
        let manifest: Manifest = {}
        let batchRecordId: string

        if (mode === "resume") {
          const existing = await prisma.signBatch.findFirst({
            where: { batchCode: resumeBatchId, jenisSk: JENIS_SPMT, status: "processing" },
          })
          if (!existing) {
            send({ type: "error", error: "Batch yang mau dilanjutkan tidak ditemukan (mungkin sudah selesai atau ID salah)" })
            return
          }
          if (!isSuperAdmin(session as any) && existing.signedBy !== session.user.email) {
            send({ type: "error", error: "Batch ini bukan milikmu, tidak bisa dilanjutkan" })
            return
          }
          batchId = resumeBatchId
          batchDir = path.join(outputDir, batchId)
          if (!fs.existsSync(batchDir)) {
            send({ type: "error", error: "Folder dokumen batch ini sudah tidak ada di server, tidak bisa dilanjutkan. Mulai batch baru." })
            return
          }
          batchRecordId = existing.id
          manifest = readManifest(batchDir)
        } else {
          batchId = uuidv4()
          batchDir = path.join(outputDir, batchId)
          fs.mkdirSync(batchDir, { recursive: true })
          const created = await prisma.signBatch.create({
            data: {
              batchCode: batchId,
              jenisSk: JENIS_SPMT,
              total: rows.length,
              successCount: 0,
              errorCount: 0,
              status: "processing",
              signedBy: session.user.email!,
            },
          })
          batchRecordId = created.id
        }

        const total = rows.length

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

        send({ type: "start", total, tte: useTte, batchId, resumed: mode === "resume" })

        type DocMeta = {
          no: number
          nip: string
          nama: string
          fileName: string
          verifyToken: string | null
          documentNo: string
          title: string
          ok: boolean
          alreadySigned: boolean
          error?: string
        }
        const docMetas: DocMeta[] = []

        const BATCH_SIZE = 32 // server kuat (32 core/128GB) - 16x Gotenberg paralel
        let genProcessed = 0

        async function generateRow(row: any, rowIndex: number) {
          const parsed = getRowData(row, rowIndex, batch)
          if (!parsed) return

          const { nip, nama, data } = parsed
          const fileName = `${FILE_PREFIX}_${dateStr}_${nip}.pdf`

          // Sudah pernah sukses digenerate di attempt sebelumnya (resume) — jangan render ulang.
          const existing = manifest[nip]
          if (existing && fs.existsSync(path.join(batchDir, existing.fileName))) {
            docMetas.push({
              no: rowIndex + 1, nip, nama, fileName: existing.fileName, verifyToken: existing.verifyToken,
              documentNo: existing.documentNo, title: `${JENIS_SPMT} - ${nama}`, ok: true,
              alreadySigned: existing.phase === "signed",
            })
            genProcessed++
            send({ type: "progress", phase: "generate", processed: genProcessed, total, nip, nama, status: "success", fileName: existing.fileName, resumed: true })
            return
          }

          try {
            const docxBuffer = renderDocx(templateBuffer, data)
            const pdfBuffer = await convertDocxToPdf(docxBuffer, `${nip}.docx`)
            let finalPdf: Buffer
            const verifyToken = useQr ? uuidv4() : null

            if (useQr && verifyToken) {
              const verifyUrl = publicVerifyUrl(verifyToken)
              finalPdf = await injectQrToPdf(pdfBuffer, verifyUrl, qrX, qrY, qrWidth, qrHeight, pageNumber, pdfScale, canvasHeight)
            } else {
              finalPdf = pdfBuffer
            }

            await writeFile(path.join(batchDir, fileName), finalPdf)
            manifest[nip] = { fileName, nama, documentNo: data.nomor_surat, verifyToken, phase: "generated" }
            docMetas.push({
              no: rowIndex + 1, nip, nama, fileName, verifyToken,
              documentNo: data.nomor_surat, title: `${JENIS_SPMT} - ${nama}`, ok: true, alreadySigned: false,
            })
            genProcessed++
            send({ type: "progress", phase: "generate", processed: genProcessed, total, nip, nama, status: "success", fileName })

          } catch (err: any) {
            console.error(`[SPMT GENERATE FAILED] NIP: ${nip} | Nama: ${nama} | Error: ${err?.message}`)
            docMetas.push({
              no: rowIndex + 1, nip, nama, fileName, verifyToken: null,
              documentNo: nip, title: `${JENIS_SPMT} - ${nama}`, ok: false, alreadySigned: false, error: err?.message || "Gagal generate",
            })
            genProcessed++
            send({ type: "progress", phase: "generate", processed: genProcessed, total, nip, nama, status: "error", error: err?.message || "Gagal" })
          }
        }

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batchRows = rows.slice(i, i + BATCH_SIZE)
          await Promise.all(batchRows.map((row, idx) => generateRow(row, i + idx)))
          writeManifest(batchDir, manifest) // checkpoint tiap gelombang — batas kerugian kalau putus cuma 1 gelombang (≤6 dok)
        }

        if (useTte) {
          const okDocs = docMetas.filter(d => d.ok)
          const alreadySignedDocs = okDocs.filter(d => d.alreadySigned)
          const docsToSign = okDocs.filter(d => !d.alreadySigned)
          let signProcessed = 0
          send({ type: "status", message: "Menandatangani dokumen via BSrE..." })

          // Dokumen yang di attempt sebelumnya sudah kelar TTE — langsung dilaporkan sukses, gak ditandatangani ulang.
          for (const d of alreadySignedDocs) {
            signProcessed++
            send({ type: "progress", phase: "sign", processed: signProcessed, total: okDocs.length, nip: d.nip, nama: d.nama, status: "success", fileName: d.fileName, resumed: true })
          }

          for (let i = 0; i < docsToSign.length; i += chunkSize) {
            const chunk = docsToSign.slice(i, i + chunkSize)
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
                  if (manifest[d.nip]) manifest[d.nip].phase = "signed"
                }
              }
              signProcessed++
              send({
                type: "progress", phase: "sign", processed: signProcessed, total: okDocs.length,
                nip: d.nip, nama: d.nama, status: d.ok ? "success" : "error", fileName: d.ok ? d.fileName : undefined, error: d.error,
              })
            })

            writeManifest(batchDir, manifest) // checkpoint tiap chunk TTE
          }
        }

        const verifyDocs = docMetas.filter(d => d.ok && d.verifyToken)
        const docRecords: Array<{
          title: string
          documentNo: string
          filePath: string
          verifyToken: string
        }> = []

        for (const d of verifyDocs) {
          try {
            const pdfBuffer = fs.readFileSync(path.join(batchDir, d.fileName))
            const objectName = `verify/${d.verifyToken}.pdf`
            await uploadToMinio(MINIO_BUCKET, objectName, pdfBuffer)
            const presignedUrl = await getPresignedUrl(MINIO_BUCKET, objectName)

            docRecords.push({
              title: d.title,
              documentNo: d.documentNo,
              filePath: presignedUrl,
              verifyToken: d.verifyToken!,
            })
          } catch (uploadErr: any) {
            console.error(`[MINIO UPLOAD ERROR] Verify: ${d.verifyToken} | ${uploadErr?.message}`)
          }
        }

        if (docRecords.length > 0) {
          try {
            await prisma.document.createMany({ data: docRecords, skipDuplicates: true })
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

        const zipFileName = `${FILE_PREFIX}_${dateStr}_${batchId.slice(0, 8)}.zip`
        const zipFilePath = path.join(outputDir, zipFileName)
        const admZip = new AdmZip()
        for (const d of docMetas) {
          if (d.ok) admZip.addLocalFile(path.join(batchDir, d.fileName))
        }
        admZip.writeZip(zipFilePath)

        const reportwb = XLSX.utils.book_new()
        const summaryData = [
          ["Laporan Generate SPMT Massal"],
          ["Jenis Dokumen", JENIS_SPMT],
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

        const reportFileName = `LAPORAN_${FILE_PREFIX}_${dateStr}_${batchId.slice(0, 8)}.xlsx`
        const reportBuffer = XLSX.write(reportwb, { type: "buffer", bookType: "xlsx" })

        let zipMinioPath: string | null = null
        let reportMinioPath: string | null = null
        try {
          zipMinioPath = await uploadToMinio(MINIO_BUCKET, `batch/${batchId}/${zipFileName}`, fs.readFileSync(zipFilePath))
          reportMinioPath = await uploadToMinio(MINIO_BUCKET, `batch/${batchId}/${reportFileName}`, reportBuffer)
        } catch (minioErr: any) {
          console.error(`[MINIO UPLOAD ERROR] Batch: ${batchId} | ${minioErr?.message}`)
        }

        // Baru hapus folder batch (+ manifest) SETELAH zip & upload sukses — sebelum titik ini,
        // kalau proses mati di tengah jalan, folder tetap ada dan batch masih bisa di-resume.
        fs.rmSync(batchDir, { recursive: true, force: true })

        try {
          await prisma.signBatch.update({
            where: { id: batchRecordId },
            data: {
              total, successCount, errorCount,
              zipFileName: zipMinioPath || zipFileName,
              reportFileName: reportMinioPath || reportFileName,
              status: "done",
            },
          })

          await prisma.signLog.createMany({
            data: allResults.map(r => ({
              batchId: batchRecordId,
              jenisSk: JENIS_SPMT,
              namaFile: r.fileName ?? null,
              nip: r.nip,
              nama: r.nama,
              status: r.status === "Berhasil" ? "success" : "error",
              errorMessage: r.error ?? null,
              signedBy: session.user.email!,
            })),
          })

          console.log(`[SIGN BATCH] ${batchId} | ${JENIS_SPMT} | Total: ${total} | Berhasil: ${successCount} | Gagal: ${errorCount} | By: ${session.user.email}`)
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
        // Sengaja TIDAK menghapus batchDir/manifest di sini — biar bisa di-resume atau diunduh
        // sebagian lewat /api/bulk-sign-spmt/partial/[batchId].
        console.error("[SPMT BULK SIGN ERROR]", err?.message)
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
