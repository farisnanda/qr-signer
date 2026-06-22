"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function DeleteUserButton({ userId }: { userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm("Yakin hapus user ini?")) return
    setLoading(true)
    try {
      await fetch("/api/users/" + userId, { method: "DELETE" })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? "..." : "Hapus"}
    </button>
  )
}