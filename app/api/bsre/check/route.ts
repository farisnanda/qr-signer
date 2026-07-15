import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkUserStatusV2 } from "@/lib/bsre"

// Pre-check status sertifikat penandatangan sebelum memproses batch TTE.
// Kredensial dikirim transien dari klien — tidak disimpan/di-log.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bsreUsername, bsrePassword, nik } = await req.json()
  const baseUrl = process.env.BSRE_BASE_URL || ""

  if (!baseUrl) {
    return NextResponse.json({ error: "BSRE_BASE_URL belum dikonfigurasi di server" }, { status: 500 })
  }
  if (!bsreUsername || !bsrePassword || !nik) {
    return NextResponse.json({ error: "Username, password, dan NIK wajib diisi" }, { status: 400 })
  }

  const chk = await checkUserStatusV2({ baseUrl, username: bsreUsername, password: bsrePassword, nik })

  if (!chk.ok) {
    return NextResponse.json({ error: chk.error || "Pre-check BSrE gagal" }, { status: 502 })
  }

  return NextResponse.json({
    active: chk.active,
    status: chk.statusText,
    message: chk.message,
  })
}
