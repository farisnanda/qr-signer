import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const pathname = req.nextUrl.pathname

  if (pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
    if (token.role === "PENGIRIM") {
      return NextResponse.redirect(new URL("/portal/dashboard", req.url))
    }
    return NextResponse.next()
  }

  if (pathname.startsWith("/portal/dashboard") || pathname.startsWith("/portal/kirim")) {
    if (!token) {
      return NextResponse.redirect(new URL("/portal/login", req.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/dashboard/:path*",
    "/portal/kirim/:path*",
  ],
}