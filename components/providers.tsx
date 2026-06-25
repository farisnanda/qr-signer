"use client"

import { SessionProvider } from "next-auth/react"
import { useEffect, useRef } from "react"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const IDLE_TIMEOUT = 30 * 60 * 1000

function AutoLogout() {
  const { data: session } = useSession()
  const router = useRouter()
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  function resetTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await signOut({ redirect: false })
      router.push("/login?reason=timeout")
    }, IDLE_TIMEOUT)
  }

  useEffect(() => {
    if (!session) return
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"]
    events.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()
    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [session])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/qr-signer/api/auth" refetchInterval={0} refetchOnWindowFocus={true}>
      <AutoLogout />
      {children}
    </SessionProvider>
  )
}