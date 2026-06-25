"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function Reset2FAButton({ userId, twoFactorEnabled }: { userId: string; twoFactorEnabled: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!twoFactorEnabled) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
        Off
      </span>
    )
  }

  async function handleReset() {
    if (!confirm("Reset 2FA user ini? User harus setup ulang 2FA saat login berikutnya.")) return
    setLoading(true)
    try {
      await fetch(`/qr-signer/api/users/${userId}/reset-2fa`, { method: "POST" })
      router.refresh()
    } catch {}
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">On</span>
      <button
        onClick={handleReset}
        disabled={loading}
        className="rounded-lg border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {loading ? "..." : "Reset"}
      </button>
    </div>
  )
}