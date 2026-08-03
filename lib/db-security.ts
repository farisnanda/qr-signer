import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto"

const ENCRYPTED_PREFIX = "enc:v1:"

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

function getEncryptionKey(): Buffer {
  const secret = process.env.TWO_FACTOR_SECRET_KEY || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("TWO_FACTOR_SECRET_KEY atau NEXTAUTH_SECRET wajib diset untuk enkripsi 2FA")
  }
  return createHash("sha256").update(secret, "utf8").digest()
}

export function hashLookup(value: string, purpose: string): string {
  return createHmac("sha256", getEncryptionKey()).update(`${purpose}:${value}`, "utf8").digest("hex")
}

export function encryptSecretValue(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    ENCRYPTED_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join("")
}

export function decryptSecretValue(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value

  const payload = value.slice(ENCRYPTED_PREFIX.length)
  const [ivB64, tagB64, encryptedB64] = payload.split(":")
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error("Format secret 2FA terenkripsi tidak valid")
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivB64, "base64url"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export const encryptTwoFactorSecret = encryptSecretValue
export const decryptTwoFactorSecret = decryptSecretValue
