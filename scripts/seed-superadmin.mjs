#!/usr/bin/env node
/**
 * Seed script: buat akun SUPERADMIN di production
 *
 * Jalankan dari server:
 *   cd /home/bkd/qr-signer
 *   node scripts/seed-superadmin.mjs
 *
 * Input: email, nama, password (akan di-hash)
 */
import { config } from "dotenv"
config({ path: ".env" })
config({ path: ".env.local", override: true })

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import readline from "readline"

const prisma = new PrismaClient()

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  console.log("\n=== Seed Akun SUPERADMIN ===\n")

  const email = await askQuestion("Email: ")
  if (!email || !email.includes("@")) {
    console.log("❌ Email tidak valid")
    process.exit(1)
  }

  const nama = await askQuestion("Nama: ")
  if (!nama.trim()) {
    console.log("❌ Nama tidak boleh kosong")
    process.exit(1)
  }

  const password = await askQuestion("Password: ")
  if (!password || password.length < 6) {
    console.log("❌ Password minimal 6 karakter")
    process.exit(1)
  }

  // Cek apakah user sudah ada
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`❌ User ${email} sudah ada`)
    process.exit(1)
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name: nama,
      password: hashedPassword,
      role: "SUPERADMIN",
      bidang: undefined,
      twoFactorEnabled: false,
    },
  })

  console.log("\n✅ Akun SUPERADMIN berhasil dibuat:")
  console.log(`   Email: ${user.email}`)
  console.log(`   Nama: ${user.name}`)
  console.log(`   Role: ${user.role}`)
  console.log(`   ID: ${user.id}\n`)
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
