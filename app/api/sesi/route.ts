import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function generateUniquePin(): Promise<string> {
  // PIN 6 digit, unik di antara sesi yang masih aktif agar validasi tak ambigu.
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000))
    const clash = await prisma.sesi.findFirst({ where: { pin, aktif: true } })
    if (!clash) return pin
  }
  throw new Error("Gagal membuat PIN unik")
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as any)?.kind === "peserta") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { nama } = await request.json().catch(() => ({ nama: "" }))
  const clean = String(nama || "").trim()
  if (!clean) {
    return Response.json({ error: "Nama sesi wajib diisi" }, { status: 400 })
  }

  const pin = await generateUniquePin()
  const sesi = await prisma.sesi.create({
    data: { nama: clean, pin, createdBy: session.user.email },
  })
  return Response.json({ ok: true, sesi })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as any)?.kind === "peserta") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, aktif } = await request.json().catch(() => ({}))
  if (!id || typeof aktif !== "boolean") {
    return Response.json({ error: "Parameter tidak lengkap" }, { status: 400 })
  }

  await prisma.sesi.update({ where: { id: String(id) }, data: { aktif } })
  return Response.json({ ok: true })
}
