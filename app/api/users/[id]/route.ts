import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { headers } from "next/headers"
import bcrypt from "bcryptjs"

type Props = {
  params: Promise<{ id: string }>
}

export async function GET(req: Request, props: Props) {
  try {
    await headers()
    const session = await getServerSession(authOptions)

    if (session?.user?.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await props.params
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true, role: true, bidang: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Terjadi kesalahan" }, { status: 500 })
  }
}

export async function PATCH(req: Request, props: Props) {
  try {
    await headers()
    const session = await getServerSession(authOptions)

    if (session?.user?.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await props.params
    const body = await req.json()
    const { name, email, password, role, bidang } = body

    const data: any = { name, email, role, bidang }

    if (password) {
      data.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ success: true, id: user.id })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Terjadi kesalahan" }, { status: 500 })
  }
}

export async function DELETE(req: Request, props: Props) {
  try {
    await headers()
    const session = await getServerSession(authOptions)

    if (session?.user?.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await props.params

    if (params.id === session.user.id) {
      return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 })
    }

    await prisma.user.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Terjadi kesalahan" }, { status: 500 })
  }
}