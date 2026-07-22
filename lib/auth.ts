import { prisma } from "@/lib/prisma"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!passwordMatch) return null

        // 2FA sudah aktif → lempar error, tangani di login page
        if (user.twoFactorEnabled) {
          throw new Error("2FA_REQUIRED")
        }

        // 2FA belum di-setup → lempar error, tangani di login page
        if (!user.twoFactorEnabled) {
          throw new Error("2FA_SETUP_REQUIRED")
        }

        // Seharusnya tidak sampai sini, tapi return untuk safety
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          bidang: user.bidang ?? undefined,
          twoFactorEnabled: user.twoFactorEnabled,
        }
      },
    }),
    // Login peserta: identifikasi via NIP, tanpa 2FA. Hanya boleh setelah
    // email terverifikasi.
    CredentialsProvider({
      id: "peserta",
      name: "peserta",
      credentials: {
        nip: {},
        password: {},
      },
      async authorize(credentials: any) {
        if (!credentials?.nip || !credentials?.password) return null

        const peserta = await prisma.peserta.findUnique({
          where: { nip: String(credentials.nip).trim() },
        })
        if (!peserta || !peserta.password) return null

        if (!peserta.emailVerified) {
          throw new Error("BELUM_VERIFIKASI")
        }

        const ok = await bcrypt.compare(credentials.password, peserta.password)
        if (!ok) return null

        return {
          id: peserta.id,
          name: peserta.nama,
          nip: peserta.nip,
          kind: "peserta",
        } as any
      },
    }),
  ],

  session: {
    strategy: "jwt" as const,
    maxAge: 8 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    error: "/login",  // ← FIX: redirect error ke /qr-signer/login?error=...
  },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        if (user.kind === "peserta") {
          token.kind = "peserta"
          token.nip = user.nip
          token.pesertaId = user.id
        } else {
          token.role = user.role
          token.bidang = user.bidang
          token.twoFactorEnabled = user.twoFactorEnabled
          token.twoFactorVerified = true
        }
      }

      if (account?.provider === "google") {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.bidang = dbUser.bidang ?? undefined
          token.id = dbUser.id
          token.twoFactorEnabled = dbUser.twoFactorEnabled
          token.twoFactorVerified = true
        } else {
          token.role = "PENGIRIM"
          token.bidang = undefined
          token.twoFactorVerified = true
        }
      }

      if (token.kind !== "peserta" && !token.role && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, bidang: true, twoFactorEnabled: true },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.bidang = dbUser.bidang ?? undefined
          token.twoFactorEnabled = dbUser.twoFactorEnabled
        }
      }

      return token
    },

    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub || token.id || token.pesertaId
        session.user.role = token.role
        session.user.bidang = token.bidang
        session.user.twoFactorEnabled = token.twoFactorEnabled
        session.user.twoFactorVerified = token.twoFactorVerified
        session.user.kind = token.kind
        session.user.nip = token.nip
      }
      return session
    },
  },
}