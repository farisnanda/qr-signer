import { readFileSync } from "fs"
import { join } from "path"
import PizZip from "pizzip"
import { PDFDocument } from "pdf-lib"

interface SumpahData {
  nama: string
  nip: string
  jabatan: string
  agama: "Islam" | "Kristen" | "Budha" | "Hindu" | "Katolik"
}

export async function generateSumpahDocx(data: SumpahData): Promise<Buffer> {
  const templateDir = join(process.cwd(), "templates/CEK")
  const templatePath = join(templateDir, `${data.agama}.docx`)

  const templateBuffer = readFileSync(templatePath)
  const zip = new PizZip(templateBuffer)
  const xmlString = zip.file("word/document.xml")?.asText()

  if (!xmlString) {
    throw new Error("Failed to extract document.xml from template")
  }

  let replacedXml = xmlString
    .replace(/{nama_diambil_sumpah}/g, data.nama)
    .replace(/{nip_diambil_sumpah}/g, data.nip)
    .replace(/{pangkat_diambil_sumpah}/g, data.jabatan)

  zip.file("word/document.xml", replacedXml)

  return Buffer.from(zip.generate({ type: "arraybuffer" }))
}

export async function convertDocxToPdfViaGotenberg(docxBuffer: Buffer): Promise<Buffer> {
  const gotenbergUrl = process.env.GOTENBERG_URL || "http://localhost:3000"

  const formData = new FormData()
  const blob = new Blob([new Uint8Array(docxBuffer)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
  formData.append("files", blob, "document.docx")

  const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gotenberg error: ${response.status} - ${errText}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

export async function generateSumpahPdf(
  data: SumpahData,
  opts: { singlePage?: boolean } = {}
): Promise<Buffer> {
  const { singlePage = true } = opts
  const docxBuffer = await generateSumpahDocx(data)
  const pdfBuffer = await convertDocxToPdfViaGotenberg(docxBuffer)

  // Paksa 1 halaman (opsional): buang halaman ke-2 dst.
  if (singlePage) {
    const pdfCheck = await PDFDocument.load(pdfBuffer)
    if (pdfCheck.getPageCount() > 1) {
      const singleDoc = await PDFDocument.create()
      const [firstPage] = await singleDoc.copyPages(pdfCheck, [0])
      singleDoc.addPage(firstPage)
      return Buffer.from(await singleDoc.save())
    }
  }

  return pdfBuffer
}

/** Format tanggal hari ini sebagai DDMMYYYY (waktu lokal). */
export function todayDDMMYYYY(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}${mm}${d.getFullYear()}`
}

/**
 * Nama file: SUMPAH_PNS_<DDMMYYYY>_<NIP>.pdf
 * @param dateStr tanggal 8 digit DDMMYYYY; kalau kosong/invalid pakai hari ini.
 */
export function getSumpahFilename(nip: string, dateStr?: string): string {
  const ddmmyyyy = dateStr && /^\d{8}$/.test(dateStr) ? dateStr : todayDDMMYYYY()
  return `SUMPAH_PNS_${ddmmyyyy}_${nip}.pdf`
}
