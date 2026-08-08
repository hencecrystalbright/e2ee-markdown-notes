import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, clearRateLimit } from "@/lib/rateLimit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req: any) {
        // 1. 安全抽取 Client IP
        const headers = req?.headers;
        let clientIp = "127.0.0.1";

        if (headers) {
          const forwarded = typeof headers.get === "function" 
            ? headers.get("x-forwarded-for") 
            : (headers as Record<string, string>)["x-forwarded-for"];

          if (forwarded) {
            clientIp = forwarded.split(",")[0].trim();
          }
        }

        // 2. Rate Limit 試錯檢查 (5 次上限)
        const account = credentials?.email as string;
        const { isRateLimited } = checkRateLimit(clientIp, account, 5);
        
        if (isRateLimited) {
          throw new Error("⚠️ 登入失敗次數過多，IP 或 該帳號已被暫時鎖定！請 18 分鐘後再試。Many failed login . Please try again after 18 mins.");
        }

        // 3. 執行帳密驗證邏輯
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        // 4. 驗證成功，清除失敗紀錄
        clearRateLimit(clientIp, account);

        // 回傳使用者物件 (包含 id)
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  // 🔑 最關鍵的修正：補上 Callbacks 將 user.id 鎖進 JWT & Session
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // 把 ID 塞進加密 Token
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string; // 從 Token 讀出 ID 賦予 Session
      }
      return session;
    },
  },
});