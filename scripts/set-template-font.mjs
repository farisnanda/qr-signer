/**
 * Menyeragamkan font seluruh template Berita Acara Sumpah ke Tahoma.
 *
 * Memakai DOM parser, bukan regex: <w:rFonts> punya beberapa bentuk atribut
 * (ascii/hAnsi/cs/eastAsia dan varian *Theme). Atribut *Theme menimpa atribut
 * eksplisit, jadi harus dibuang, bukan sekadar ditimpa.
 *
 * Jalankan dari root project:  node scripts/set-template-font.mjs
 * Pastikan template tidak sedang dibuka di Word (file lock ~$ akan merusak hasil).
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import PizZip from "pizzip"
import { DOMParser, XMLSerializer } from "@xmldom/xmldom"

const FONT = "Tahoma"
const TEMPLATE_DIR = "templates/CEK"
const TEMPLATES = ["Islam", "Kristen", "Budha", "Hindu", "Katolik"]
const PARTS = ["word/document.xml", "word/styles.xml"]

const EXPLICIT_ATTRS = ["w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"]
const THEME_ATTRS = ["w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"]

function setFontInPart(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml")
  const nodes = doc.getElementsByTagName("w:rFonts")
  let changed = 0

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]

    // Atribut theme menang atas atribut eksplisit, jadi dibuang lebih dulu.
    for (const attr of THEME_ATTRS) {
      if (el.hasAttribute(attr)) {
        el.removeAttribute(attr)
        changed++
      }
    }

    for (const attr of EXPLICIT_ATTRS) {
      if (el.getAttribute(attr) !== FONT) {
        el.setAttribute(attr, FONT)
        changed++
      }
    }
  }

  return { xml: new XMLSerializer().serializeToString(doc), nodes: nodes.length, changed }
}

let failed = false

for (const name of TEMPLATES) {
  const path = join(TEMPLATE_DIR, `${name}.docx`)
  const lock = join(TEMPLATE_DIR, `~$${name}.docx`)

  if (existsSync(lock)) {
    console.error(`${name}: ADA FILE LOCK ${lock} — tutup dulu di Word. Dilewati.`)
    failed = true
    continue
  }

  const zip = new PizZip(readFileSync(path))
  const report = []

  for (const part of PARTS) {
    const file = zip.file(part)
    if (!file) continue
    const { xml, nodes, changed } = setFontInPart(file.asText())
    zip.file(part, xml)
    report.push(`${part.replace("word/", "")}: ${nodes} rFonts, ${changed} atribut diubah`)
  }

  writeFileSync(path, Buffer.from(zip.generate({ type: "arraybuffer" })))
  console.log(`${name}: ${report.join(" | ")}`)
}

process.exit(failed ? 1 : 0)
