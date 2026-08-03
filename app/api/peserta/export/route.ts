import { prisma } from "@/lib/prisma"
import { requireAdminRole } from "@/lib/security"
import { utils, write } from "xlsx"
import type { Prisma } from "@prisma/client"

function statusWhere(status: string): Prisma.PesertaWhereInput {
  if (status === "aktif") return { emailVerified: true }
  if (status === "pending") return { email: { not: null }, emailVerified: false }
  if (status === "belum") return { email: null }
  return {}
}

function statusLabel(p: { email: string | null; emailVerified: boolean }) {
  if (!p.email) return "Belum aktivasi"
  if (!p.emailVerified) return "Menunggu verifikasi"
  return "Aktif"
}

export async function GET(request: Request) {
  const session = await requireAdminRole(["SUPERADMIN", "ADMIN"])
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()
  const rawStatus = searchParams.get("status") || ""
  const status = ["aktif", "pending", "belum"].includes(rawStatus) ? rawStatus : ""

  const filters: Prisma.PesertaWhereInput[] = []
  if (q) {
    filters.push({
      OR: [
        { nip: { contains: q, mode: "insensitive" } },
        { nama: { contains: q, mode: "insensitive" } },
        { perangkatDaerah: { contains: q, mode: "insensitive" } },
      ],
    })
  }
  const sw = statusWhere(status)
  if (Object.keys(sw).length > 0) filters.push(sw)
  const where: Prisma.PesertaWhereInput = filters.length > 0 ? { AND: filters } : {}

  const peserta = await prisma.peserta.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      nip: true,
      nama: true,
      pangkat: true,
      perangkatDaerah: true,
      agama: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const rows = peserta.map((p, i) => ({
    No: i + 1,
    NIP: p.nip,
    Nama: p.nama,
    Pangkat: p.pangkat,
    "Perangkat Daerah": p.perangkatDaerah,
    Agama: p.agama,
    Email: p.email || "",
    Status: statusLabel(p),
    "Tanggal Import": p.createdAt.toLocaleString("id-ID"),
    "Terakhir Update": p.updatedAt.toLocaleString("id-ID"),
  }))

  const ws = utils.json_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, "Peserta")
  const buf: Buffer = write(wb, { type: "buffer", bookType: "xlsx" })

  const suffix = status ? `_${status}` : ""
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Peserta${suffix}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
