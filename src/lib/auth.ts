import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null
          const user = await db.user.findUnique({
            where: { email: credentials.email as string },
          })
          if (!user || !user.password) return null
          const valid = await bcrypt.compare(credentials.password as string, user.password)
          if (!valid) return null
          return { id: user.id, email: user.email, name: user.name }
        } catch (e) {
          console.error("[authorize] ERROR:", e)
          return null
        }
      },
    }),
  ],
})
