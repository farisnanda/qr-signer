export const PANGKAT_MAP: Record<string, string> = {
  "I/a": "Juru Muda",
  "I/b": "Juru Muda Tingkat I",
  "I/c": "Juru",
  "I/d": "Juru Tingkat I",
  "II/a": "Pengatur Muda",
  "II/b": "Pengatur Muda Tingkat I",
  "II/c": "Pengatur",
  "II/d": "Pengatur Tingkat I",
  "III/a": "Penata Muda",
  "III/b": "Penata Muda Tingkat I",
  "III/c": "Penata",
  "III/d": "Penata Tingkat I",
  "IV/a": "Pembina",
  "IV/b": "Pembina Tingkat I",
  "IV/c": "Pembina Utama Muda",
  "IV/d": "Pembina Utama Madya",
  "IV/e": "Pembina Utama",
}

export function getJabatan(pangkat: string): string {
  return PANGKAT_MAP[pangkat.trim()] || pangkat
}

/**
 * Normalisasi input pangkat dari Excel ke KODE golongan kanonik (mis. "II/c").
 * Menerima dua bentuk, karena pengirim Excel kadang menulis kode, kadang nama:
 *   - kode : "II/c", "ii/c", "II / C", "II-c"
 *   - nama : "Pengatur", "pengatur tingkat i", "Pengatur Tk.I", "Penata Muda Tk. 1"
 * Mengembalikan null bila tidak dikenali, agar importer bisa melaporkan barisnya
 * ketimbang menyimpan nilai keliru yang berujung salah jabatan di dokumen.
 */
export function normalizePangkat(input: string): string | null {
  const raw = String(input ?? "").trim()
  if (!raw) return null

  // 1) Coba sebagai KODE golongan.
  const asCode = raw.replace(/[\s\-.]/g, "").toUpperCase() // "ii / c" -> "II/C"
  const m = asCode.match(/^(IV|I{1,3})\/([A-E])$/)
  if (m) {
    const canonical = `${m[1]}/${m[2].toLowerCase()}`
    return PANGKAT_MAP[canonical] ? canonical : null
  }

  // 2) Coba sebagai NAMA pangkat, dengan menyeragamkan singkatan "Tingkat I".
  const name = raw
    .replace(/\bT[kK]\.?\s*/g, "Tingkat ") // "Tk.I" / "Tk I" -> "Tingkat I"
    .replace(/\bTingkat\s*1\b/gi, "Tingkat I") // angka 1 -> romawi I
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

  const found = Object.entries(PANGKAT_MAP).find(([, nama]) => nama.toLowerCase() === name)
  return found ? found[0] : null
}
