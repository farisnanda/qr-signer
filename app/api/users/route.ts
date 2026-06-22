import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { headers } from "next/headers"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  try {
    await headers()
    const session = await getServerSession(authOptions)

    if (session?.user?.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, password, role, bidang } = body

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Email, password, dan role wajib diisi" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email sudah digunakan" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        bidang: role === "BIDANG" ? bidang : null,
      },
    })

    return NextResponse.json({ success: true, id: user.id })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Terjadi kesalahan" }, { status: 500 })
  }
}