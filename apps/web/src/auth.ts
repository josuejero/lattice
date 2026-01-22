import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Prisma, prisma } from "@lattice/db";
import { env } from "@/lib/env";

const providers: NextAuthConfig["providers"] = [];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    })
  );
}

if (env.NODE_ENV !== "production") {
  providers.push(
    Credentials({
      name: "Dev Sign-in",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "dev@example.com" },
      },
      async authorize(credentials) {
        const raw = credentials?.email;
        const email = typeof raw === "string" ? raw.toLowerCase().trim() : "";
        if (!email) return null;

        try {
          const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email, name: email.split("@")[0] },
            select: { id: true, email: true, name: true, image: true },
          });

          return user;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && isUniqueConstraintOnEmail(error)) {
            const existingUser = await prisma.user.findUnique({
              where: { email },
              select: { id: true, email: true, name: true, image: true },
            });
            return existingUser ?? null;
          }
          throw error;
        }
      },
    })
  );
}

function isUniqueConstraintOnEmail(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;
  if (error.code !== "P2002") {
    return false;
  }
  if (Array.isArray(target)) {
    return target.includes("email");
  }
  return target === "email";
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
