import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Halaman peserta yang boleh diakses tanpa login.
const PESERTA_PUBLIC = [
  "/peserta/login",
  "/peserta/aktivasi",
  "/peserta/verifikasi",
  "/peserta/lupa-password",
  "/peserta/reset",
]

// Redirect yang menghormati basePath (/qr-signer). nextUrl.clone() sudah
// membawa basePath, jadi cukup set pathname app-relative.
function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  return NextResponse.redirect(url)
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const pathname = req.nextUrl.pathname
  const isPeserta = (token as any)?.kind === "peserta"

  if (pathname.startsWith("/admin")) {
    if (!token) {
      return redirectTo(req, "/login")
    }
    // Peserta tidak boleh masuk area admin.
    if (isPeserta) {
      return redirectTo(req, "/peserta")
    }
    return NextResponse.next()
  }

  if (pathname.startsWith("/peserta")) {
    const isPublic = PESERTA_PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))
    if (isPublic) return NextResponse.next()
    // Halaman peserta terproteksi butuh sesi peserta.
    if (!isPeserta) {
      return redirectTo(req, "/peserta/login")
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/peserta/:path*"],
}
