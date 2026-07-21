export const PANGKAT_MAP: Record<string, string> = {
  "I/a": "Juru Muda",
  "I/b": "Juru Muda Tingkat I",
  "I/c": "Juru",
  "I/d": "Juru Tingkat I",
  "II/a": "Pengatur Muda",
  "II/b": "Pengatur Muda Tingkat I",
  "II/c": "Pengatur Muda",
  "II/d": "Pengatur Muda",
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
