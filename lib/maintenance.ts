import { prisma } from "@/lib/prisma"

// Baris tunggal (singleton) — status maintenance portal peserta.
const SINGLETON_ID = "singleton"

export type MaintenanceStatus = {
  active: boolean
  message: string | null
  activeAgainAt: Date | null
}

/**
 * Status efektif maintenance. Kalau target waktu (activeAgainAt) sudah
 * lewat, dianggap nonaktif walau flag `active` di DB masih true — admin
 * tidak perlu matikan manual, app "aktif kembali" otomatis pas waktunya.
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const row = await prisma.maintenanceMode.findUnique({ where: { id: SINGLETON_ID } })
  if (!row) return { active: false, message: null, activeAgainAt: null }

  const expired = row.activeAgainAt ? row.activeAgainAt.getTime() <= Date.now() : false
  return {
    active: row.active && !expired,
    message: row.message,
    activeAgainAt: row.activeAgainAt,
  }
}

export async function setMaintenanceStatus(input: {
  active: boolean
  message: string | null
  activeAgainAt: Date | null
  updatedBy: string
}) {
  return prisma.maintenanceMode.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...input },
    update: input,
  })
}
