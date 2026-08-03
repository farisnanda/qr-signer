import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { authOptions } from "@/lib/auth"

export const ADMIN_ROLES = ["SUPERADMIN", "ADMIN", "BIDANG", "PENGIRIM"] as const

export type AppSession = Session | null

export async function requireAuthenticatedUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).kind === "peserta") return null
  return session
}

export async function requireAdminRole(roles: readonly string[] = ADMIN_ROLES) {
  const session = await requireAuthenticatedUser()
  if (!session) return null

  const role = (session.user as any).role
  if (!role || !roles.includes(role)) return null
  return session
}

export function isSuperAdmin(session: Session) {
  return (session?.user as any)?.role === "SUPERADMIN"
}
