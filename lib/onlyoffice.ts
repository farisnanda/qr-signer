import { createHmac, randomBytes } from "crypto"

// JWT minimal HS256, sesuai spek OnlyOffice Document Server (config token +
// callback token). Ga pakai library `jsonwebtoken` biar ga nambah dependency
// — cuma butuh sign & verify HS256, sama gayanya kayak lib/security.ts.

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return buf.toString("base64url")
}

function getSecret(): string {
  const secret = process.env.ONLYOFFICE_JWT_SECRET
  if (!secret) throw new Error("ONLYOFFICE_JWT_SECRET wajib diset")
  return secret
}

export function signOnlyOfficeJwt(payload: Record<string, any>): string {
  const secret = getSecret()
  const header = { alg: "HS256", typ: "JWT" }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url")
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export function verifyOnlyOfficeJwt(token: string): Record<string, any> | null {
  const secret = getSecret()
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [encodedHeader, encodedPayload, signature] = parts

  const expected = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url")
  if (expected !== signature) return null

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

/** Key acak buat cache-busting OnlyOffice — wajib berubah tiap kali file diedit ulang. */
export function newDocumentKey(): string {
  return randomBytes(16).toString("hex")
}
