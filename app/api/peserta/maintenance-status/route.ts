import { getMaintenanceStatus } from "@/lib/maintenance"

// Publik (tanpa auth) — dipanggil dari halaman maintenance buat poll status
// & countdown, biar peserta tahu app sudah aktif lagi tanpa perlu refresh manual.
export async function GET() {
  const status = await getMaintenanceStatus()
  return Response.json(status)
}
