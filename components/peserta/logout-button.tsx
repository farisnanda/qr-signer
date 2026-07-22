"use client"

import { signOut } from "next-auth/react"

export function PesertaLogout() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/peserta/login" })}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
    >
      Logout
    </button>
  )
}
