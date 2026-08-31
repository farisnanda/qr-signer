import { readdirSync } from "fs"
import { join } from "path"

const AGAMA_LIST = ["Islam", "Kristen", "Budha", "Hindu", "Katolik"] as const
const CEK_DIR = join(process.cwd(), "templates/CEK")

export type DiscoveredTemplate = {
  agama: string
  versi: string
  localPath: string // relatif ke templates/CEK, buat identifikasi aman (bukan path absolut dari client)
}

/**
 * Scan file .docx lokal di templates/CEK/ yang BELUM dipindah ke sistem
 * SumpahTemplate (DB+Minio+OnlyOffice) — peninggalan sebelum fitur editor ada.
 * - templates/CEK/<Agama>.docx        -> versi "standar"
 * - templates/CEK/<versi>/<Agama>.docx -> versi = nama folder
 * Dipakai admin buat "import langsung dari server" tanpa upload manual.
 */
export function discoverLocalTemplates(): DiscoveredTemplate[] {
  const found: DiscoveredTemplate[] = []

  let rootEntries: string[] = []
  try {
    rootEntries = readdirSync(CEK_DIR)
  } catch {
    return found // folder ga ada = ga ada yang di-discover, bukan error fatal
  }

  for (const entry of rootEntries) {
    if (entry.endsWith(".docx")) {
      const agama = entry.replace(/\.docx$/i, "")
      if (AGAMA_LIST.includes(agama as any)) {
        found.push({ agama, versi: "standar", localPath: entry })
      }
      continue
    }

    // Subfolder = kandidat versi lama (mis. templates/CEK/2022/Islam.docx)
    let subEntries: string[] = []
    try {
      subEntries = readdirSync(join(CEK_DIR, entry))
    } catch {
      continue
    }
    for (const sub of subEntries) {
      if (!sub.endsWith(".docx")) continue
      const agama = sub.replace(/\.docx$/i, "")
      if (AGAMA_LIST.includes(agama as any)) {
        found.push({ agama, versi: entry, localPath: `${entry}/${sub}` })
      }
    }
  }

  return found
}

/** Cari 1 file lokal spesifik (dipanggil pas admin klik "Edit" pada baris hasil discover). */
export function findLocalTemplate(agama: string, versi: string): DiscoveredTemplate | null {
  return discoverLocalTemplates().find((t) => t.agama === agama && t.versi === versi) || null
}
