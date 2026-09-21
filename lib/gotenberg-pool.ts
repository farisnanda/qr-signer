// Pool round-robin ke beberapa instance Gotenberg. Kenapa: satu Gotenberg cuma
// punya satu engine LibreOffice yang convert dokumen SATU-SATU (walau HTTP-nya
// nerima banyak request bersamaan, prosesnya tetep antre di dalem). Jadi naikin
// BATCH_SIZE doang di Node gak nambah throughput convert PDF-nya — mesti nambah
// instance Gotenberg-nya sendiri biar convert-nya beneran paralel di banyak core.
//
// GOTENBERG_URLS = daftar url dipisah koma, misal:
//   http://gotenberg-signer-1:3000,http://gotenberg-signer-2:3000,...
// Kalau cuma GOTENBERG_URL (lama, satu url) yang keisi, tetep jalan (fallback).
const urls: string[] = (
  process.env.GOTENBERG_URLS?.split(",").map(u => u.trim()).filter(Boolean)
  || [process.env.GOTENBERG_URL || "http://localhost:3001"]
)

let rrIndex = 0
function nextUrl(): string {
  const url = urls[rrIndex % urls.length]
  rrIndex++
  return url
}

/**
 * Convert DOCX -> PDF lewat Gotenberg, pilih instance secara round-robin dari pool.
 * Kalau gagal di satu instance (network error / instance itu lagi down), otomatis
 * coba instance lain (retry maksimal sejumlah instance yang ada) sebelum nyerah.
 */
export async function convertDocxToPdfPooled(docxBuffer: Buffer, fileName: string): Promise<Buffer> {
  const arrayBuffer = docxBuffer.buffer.slice(
    docxBuffer.byteOffset,
    docxBuffer.byteOffset + docxBuffer.byteLength
  ) as ArrayBuffer

  let lastErr: any = null
  for (let attempt = 0; attempt < urls.length; attempt++) {
    const gotenbergUrl = nextUrl()
    try {
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
        throw new Error(`Gotenberg (${gotenbergUrl}) error: ${res.status} - ${errText}`)
      }
      return Buffer.from(await res.arrayBuffer())
    } catch (err: any) {
      lastErr = err
      // coba instance berikutnya di iterasi selanjutnya
    }
  }
  throw lastErr || new Error("Gotenberg: semua instance gagal")
}

export function gotenbergPoolSize(): number {
  return urls.length
}
