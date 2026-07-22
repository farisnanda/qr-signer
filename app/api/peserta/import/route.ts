import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { read, utils } from "xlsx"

const AGAMA_VALID = ["Islam", "Kristen", "Budha", "Hindu", "Katolik"]

/** Ambil nilai kolom secara fleksibel (case-insensitive, abaikan spasi/underscore). */
function pick(row: Record<string, any>, keys: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_]/g, "")
  const wanted = keys.map(norm)
  for (const k of Object.keys(row)) {
    if (wanted.includes(norm(k))) return String(row[k] ?? "").trim()
  }
  return ""
}

function normalizeAgama(v: string): string | null {
  const found = AGAMA_VALID.find((a) => a.toLowerCase() === v.toLowerCase())
  return found ?? null
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File
  if (!file) {
    return Response.json({ error: "File tidak ditemukan" }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const workbook = read(buffer)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json<Record<string, any>>(sheet)

  if (rows.length === 0) {
    return Response.json({ error: "Excel kosong" }, { status: 400 })
  }

  let created = 0
  let updated = 0
  const errors: Array<{ baris: number; nip: string; pesan: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const nip = pick(row, ["nip", "nip baru", "nipbaru"])
    const nama = pick(row, ["nama"])
    const pangkat = pick(row, ["pangkat", "gol ruang", "gol. ruang", "golruang"])
    const perangkatDaerah = pick(row, ["perangkat daerah", "perangkatdaerah", "skpd", "opd", "unit kerja"])
    const agamaRaw = pick(row, ["agama"])

    if (!nip || !nama || !pangkat || !perangkatDaerah || !agamaRaw) {
      errors.push({ baris: i + 2, nip, pesan: "Data tidak lengkap (butuh NIP, Nama, Pangkat, Perangkat Daerah, Agama)" })
      continue
    }

    const agama = normalizeAgama(agamaRaw)
    if (!agama) {
      errors.push({ baris: i + 2, nip, pesan: `Agama tidak dikenali: "${agamaRaw}" (Islam/Kristen/Budha/Hindu/Katolik)` })
      continue
    }

    try {
      const existing = await prisma.peserta.findUnique({ where: { nip } })
      if (existing) {
        // Update data profil saja; JANGAN sentuh email/password/verifikasi peserta.
        await prisma.peserta.update({
          where: { nip },
          data: { nama, pangkat, perangkatDaerah, agama },
        })
        updated++
      } else {
        await prisma.peserta.create({
          data: { nip, nama, pangkat, perangkatDaerah, agama },
        })
        created++
      }
    } catch (err: any) {
      errors.push({ baris: i + 2, nip, pesan: err?.message || "Gagal simpan" })
    }
  }

  return Response.json({
    total: rows.length,
    created,
    updated,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  })
}
