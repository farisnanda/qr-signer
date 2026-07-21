import { readFileSync } from "fs"
import { join } from "path"
import PizZip from "pizzip"

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

  // Force 1 page: A4 dengan margins minimal, scale to fit
  formData.append("paperWidth", "8.27")  // A4 width in inches
  formData.append("paperHeight", "11.69") // A4 height in inches
  formData.append("marginTop", "0.3")
  formData.append("marginBottom", "0.3")
  formData.append("marginLeft", "0.3")
  formData.append("marginRight", "0.3")
  formData.append("scale", "1")

  const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Gotenberg error: ${response.status} ${response.statusText}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

export async function generateSumpahPdf(data: SumpahData): Promise<Buffer> {
  const docxBuffer = await generateSumpahDocx(data)
  const pdfBuffer = await convertDocxToPdfViaGotenberg(docxBuffer)
  return pdfBuffer
}

export function getSumpahFilename(nip: string, date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = date.getFullYear()
  return `SUMPAH_PNS_${dd}${mm}${yyyy}_${nip}.pdf`
}
