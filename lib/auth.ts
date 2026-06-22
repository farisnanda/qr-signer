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

        // 2FA sudah aktif → minta verifikasi kode
        if (user.twoFactorEnabled) {
          throw new Error("2FA_REQUIRED")
        }

        // 2FA belum di-setup → wajib setup dulu
        throw new Error("2FA_SETUP_REQUIRED")
      },
    }),
  ],

  session: {
    strategy: "jwt" as const,
    maxAge: 8 * 60 * 60,
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        token.role = user.role
        token.bidang = user.bidang
        token.twoFactorEnabled = user.twoFactorEnabled
        token.twoFactorVerified = true
      }

      // Login via Google — skip 2FA
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

      // Refresh token
      if (!token.role && token.sub) {
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
        session.user.id = token.sub || token.id
        session.user.role = token.role
        session.user.bidang = token.bidang
        session.user.twoFactorEnabled = token.twoFactorEnabled
        session.user.twoFactorVerified = token.twoFactorVerified
      }
      return session
    },
  },
}