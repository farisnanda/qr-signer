export const AGAMA_VALID = ["Islam", "Kristen", "Budha", "Hindu", "Katolik"] as const

/** Normalisasi input agama (case-insensitive) ke nilai kanonik. null bila tak dikenali. */
export function normalizeAgama(v: string): string | null {
  const found = AGAMA_VALID.find((a) => a.toLowerCase() === String(v ?? "").trim().toLowerCase())
  return found ?? null
}
