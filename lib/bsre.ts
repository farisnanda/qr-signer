// Klien BSrE Esign Client Service (v2) — dipakai untuk TTE bulk pada Bulk Sign SK.
//
// Autentikasi: HTTP Basic (username/password klien/instansi) di header, identitas
// penandatangan (nik + passphrase) di body. Kredensial bersifat transien — dikirim
// dari modal TTE per proses, TIDAK disimpan/di-log di server.
//
// Format response BSrE v2 (terkonfirmasi via dev esign-dev.jatimprov.go.id):
//   sign/pdf sukses : { time: <ms>, file: ["<base64 PDF>", ...] }  (urutan sesuai input)
//   sign/pdf error  : HTTP 4xx { error: "<pesan>", status_code: <int> }
//   check/status    : { status_code: "<str>", message: "<pesan>", status: "ISSUE"|"REVOKE"|... }
// Parser di bawah tetap menyimpan fallback defensif untuk bentuk lain.

export type BsreCredentials = {
  baseUrl: string
  username: string
  password: string
}

function authHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`).toString("base64")
  return `Basic ${token}`
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`
}

// Node fetch membungkus penyebab koneksi asli di `err.cause` (ECONNREFUSED, ENOTFOUND, dll).
// Tanpa ini, pesan yang muncul hanya "fetch failed" yang tidak informatif.
function describeFetchError(err: any): string {
  const cause = err?.cause
  const code = cause?.code || err?.code
  const detail = cause?.message || err?.message || "unknown error"
  return code ? `${code} — ${detail}` : detail
}

/**
 * Mengambil array PDF base64 hasil TTD dari response BSrE.
 * Format terkonfirmasi: `json.file` (array base64). Kandidat lain = fallback defensif.
 */
function extractSignedFiles(json: any): string[] {
  const candidates = [
    json?.file, // format terkonfirmasi BSrE v2
    json?.files,
    json?.data?.file,
    json?.data?.files,
    json?.data?.base64_file,
    json?.data,
    json?.result,
  ]
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      // Array of string base64, atau array of objek { file/base64/base64_file }
      if (typeof c[0] === "string") return c as string[]
      const mapped = c
        .map((it: any) => it?.file ?? it?.base64 ?? it?.base64_file ?? it?.signedFile)
        .filter((v: any) => typeof v === "string")
      if (mapped.length > 0) return mapped
    }
    if (typeof c === "string" && c.length > 0) return [c]
  }
  return []
}

export type SignatureProperty = {
  tampilan: "INVISIBLE" | "VISIBLE"
  imageBase64?: string
  page?: number
  originX?: number
  originY?: number
  width?: number
  height?: number
  location?: string
  reason?: string
  contactInfo?: string
}

export type SignPdfV2Args = BsreCredentials & {
  nik: string
  passphrase: string
  /** PDF sumber dalam base64 (tanpa prefix data URL). */
  files: string[]
  signatureProperties: SignatureProperty[]
}

export type SignPdfV2Result = {
  ok: boolean
  signed: string[]
  status: number
  raw: any
  error?: string
}

/**
 * POST /api/v2/sign/pdf — menandatangani sekumpulan PDF sekaligus (satu passphrase).
 */
export async function signPdfV2(args: SignPdfV2Args): Promise<SignPdfV2Result> {
  const { baseUrl, username, password, nik, passphrase, files, signatureProperties } = args

  let res: Response
  try {
    res = await fetch(joinUrl(baseUrl, "/api/v2/sign/pdf"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(username, password),
      },
      body: JSON.stringify({ nik, passphrase, signatureProperties, file: files }),
    })
  } catch (err: any) {
    return { ok: false, signed: [], status: 0, raw: null, error: `Gagal menghubungi BSrE: ${describeFetchError(err)}` }
  }

  let json: any = null
  const text = await res.text()
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || (typeof json === "string" ? json : `HTTP ${res.status}`)
    return { ok: false, signed: [], status: res.status, raw: json, error: String(msg) }
  }

  const signed = extractSignedFiles(json)
  if (signed.length === 0) {
    return { ok: false, signed: [], status: res.status, raw: json, error: "Response BSrE tidak berisi file tertandatangani" }
  }

  return { ok: true, signed, status: res.status, raw: json }
}

export type CheckStatusResult = {
  ok: boolean
  active: boolean | null // null = tidak bisa ditentukan dari response
  status: number
  statusText?: string // field `status` dari BSrE, mis. "ISSUE" / "REVOKE"
  message?: string // pesan human-readable dari BSrE
  raw: any
  error?: string
}

/**
 * POST /api/v2/user/check/status — pre-check sertifikat penandatangan sebelum proses batch.
 */
export async function checkUserStatusV2(args: BsreCredentials & { nik: string }): Promise<CheckStatusResult> {
  const { baseUrl, username, password, nik } = args

  let res: Response
  try {
    res = await fetch(joinUrl(baseUrl, "/api/v2/user/check/status"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(username, password),
      },
      body: JSON.stringify({ nik }),
    })
  } catch (err: any) {
    return { ok: false, active: null, status: 0, raw: null, error: `Gagal menghubungi BSrE: ${describeFetchError(err)}` }
  }

  let json: any = null
  const text = await res.text()
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || (typeof json === "string" ? json : `HTTP ${res.status}`)
    return { ok: false, active: null, status: res.status, raw: json, error: String(msg) }
  }

  return {
    ok: true,
    active: interpretStatus(json),
    status: res.status,
    statusText: typeof json?.status === "string" ? json.status : undefined,
    message: typeof json?.message === "string" ? json.message : undefined,
    raw: json,
  }
}

/**
 * Penafsiran status sertifikat dari response check/status BSrE.
 * Format asli: { status_code, message, status } — status mis. "ISSUE" (aktif) / "REVOKE" (dicabut).
 * Mengembalikan null bila tak bisa dipastikan (agar tidak salah memblokir proses).
 */
function interpretStatus(json: any): boolean | null {
  const s = String(json?.status ?? "").toUpperCase()
  if (s.includes("ISSUE") || s.includes("AKTIF") || s.includes("ACTIVE") || s.includes("VALID") || s.includes("ENROLL")) {
    return true
  }
  if (s.includes("REVOK") || s.includes("EXPIRE") || s.includes("NONAKTIF") || s.includes("SUSPEND") || s.includes("BLOCK")) {
    return false
  }
  // Fallback: cari indikasi di seluruh payload bila field `status` tak dikenali.
  const flat = JSON.stringify(json ?? "").toUpperCase()
  if (flat.includes("REVOK") || flat.includes("EXPIRE")) return false
  if (flat.includes("ISSUE") || flat.includes("AKTIF") || flat.includes("ACTIVE")) return true
  return null
}
