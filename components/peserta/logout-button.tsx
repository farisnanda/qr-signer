"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

export function PesertaLogout() {
  const router = useRouter()
  async function handleLogout() {
    // redirect:false lalu router.push -> pakai origin & basePath saat ini
    // (tidak bergantung NEXTAUTH_URL, aman di dev & prod).
    await signOut({ redirect: false })
    router.push("/peserta/login")
    router.refresh()
  }
  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
    >
      Logout
    </button>
  )
}
