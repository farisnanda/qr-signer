// Basepath aplikasi (lihat next.config.ts). Dipakai untuk membangun URL publik absolut.
const BASE_PATH = "/qr-signer"

/**
 * URL verifikasi publik untuk QR code, robust terhadap perbedaan NEXTAUTH_URL antar-environment.
 *
 * NEXTAUTH_URL kadang sudah menyertakan basepath (mis. produksi:
 * https://host/qr-signer) dan kadang tidak (mis. lokal: http://localhost:3000).
 * Fungsi ini memastikan hasilnya selalu tepat satu `/qr-signer/verify/<token>`,
 * menghindari basepath ganda yang membuat QR 404.
 */
export function publicVerifyUrl(token: string): string {
  const raw = (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "")
  const origin = raw.endsWith(BASE_PATH) ? raw.slice(0, -BASE_PATH.length) : raw
  return `${origin}${BASE_PATH}/verify/${token}`
}
