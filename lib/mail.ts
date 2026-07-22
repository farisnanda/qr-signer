import nodemailer from "nodemailer"

/**
 * Pengiriman email via SMTP (default: Resend — smtp.resend.com).
 * Env:
 *   SMTP_PASS  = API key Resend (re_...). WAJIB agar email benar-benar terkirim.
 *   SMTP_HOST  = default "smtp.resend.com"
 *   SMTP_PORT  = default 465
 *   SMTP_USER  = default "resend"
 *   MAIL_FROM  = alamat pengirim, HARUS domain/sender terverifikasi di Resend
 *                (mis. "SIGNER BKD <noreply@domainanda>"; default onboarding@resend.dev untuk tes)
 *
 * Kalau SMTP_PASS belum diset (mis. dev lokal), email TIDAK dikirim — isinya
 * di-log ke console server supaya alur verifikasi tetap bisa diuji.
 */
const SMTP_HOST = process.env.SMTP_HOST || "smtp.resend.com"
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465")
const SMTP_USER = process.env.SMTP_USER || "resend"
const SMTP_PASS = process.env.SMTP_PASS
const MAIL_FROM = process.env.MAIL_FROM || "SIGNER BKD Jatim <onboarding@resend.dev>"

// Base URL publik termasuk basePath. Di produksi NEXTAUTH_URL sudah memuat /qr-signer.
const APP_URL = (process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3100/qr-signer").replace(/\/$/, "")

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_PASS) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  }
  return transporter
}

async function sendMail(to: string, subject: string, html: string, link: string) {
  const t = getTransporter()
  if (!t) {
    // Dev fallback: tidak ada SMTP, log ke console agar alur bisa diuji.
    console.log(`\n[MAIL:DEV] SMTP belum diset — email TIDAK dikirim.`)
    console.log(`[MAIL:DEV] Ke      : ${to}`)
    console.log(`[MAIL:DEV] Subjek  : ${subject}`)
    console.log(`[MAIL:DEV] Link    : ${link}\n`)
    return { sent: false, link }
  }
  await t.sendMail({ from: MAIL_FROM, to, subject, html })
  return { sent: true, link }
}

function layout(title: string, body: string, buttonText: string, link: string) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px">SIGNER BKD Jawa Timur</h2>
    <p style="color:#64748b;margin:0 0 20px;font-size:13px">${title}</p>
    ${body}
    <p style="margin:24px 0">
      <a href="${link}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${buttonText}</a>
    </p>
    <p style="color:#94a3b8;font-size:12px">Kalau tombol tidak berfungsi, salin tautan ini:<br>${link}</p>
    <p style="color:#94a3b8;font-size:12px">Tautan berlaku 24 jam. Abaikan email ini bila Anda tidak merasa melakukan permintaan.</p>
  </div>`
}

export async function sendVerificationEmail(to: string, nama: string, token: string) {
  const link = `${APP_URL}/peserta/verifikasi?token=${token}`
  const html = layout(
    "Verifikasi akun peserta",
    `<p>Halo <strong>${nama}</strong>,</p><p>Klik tombol di bawah untuk memverifikasi email dan mengaktifkan akun peserta Anda.</p>`,
    "Verifikasi Email",
    link
  )
  return sendMail(to, "Verifikasi Akun Peserta — SIGNER BKD", html, link)
}

export async function sendResetEmail(to: string, nama: string, token: string) {
  const link = `${APP_URL}/peserta/reset?token=${token}`
  const html = layout(
    "Reset password",
    `<p>Halo <strong>${nama}</strong>,</p><p>Kami menerima permintaan reset password. Klik tombol di bawah untuk membuat password baru.</p>`,
    "Reset Password",
    link
  )
  return sendMail(to, "Reset Password — SIGNER BKD", html, link)
}
