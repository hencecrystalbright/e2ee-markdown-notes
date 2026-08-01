import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // 1. 驗證基本輸入
    if (!email || !password) {
      return NextResponse.json(
        { error: "請填寫 Email 與密碼" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密碼長度至少需 6 個字元" },
        { status: 400 }
      );
    }

    // 2. 檢查 Email 是否已被註冊
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "此 Email 已被註冊" },
        { status: 400 }
      );
    }

    // 3. 密碼鹽值哈希 (bcrypt 加密)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. 建立新使用者
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split("@")[0], // 若沒填名字，預設使用 Email 前綴
      },
    });

    return NextResponse.json(
      {
        message: "註冊成功！",
        user: { id: newUser.id, email: newUser.email, name: newUser.name },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("註冊失敗:", error);
    return NextResponse.json(
      { error: "伺服器錯誤，請稍後再試" },
      { status: 500 }
    );
  }
}