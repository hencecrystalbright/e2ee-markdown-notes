import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET: 即時驗證帳號 (account) 是否重複
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkAccount = searchParams.get("checkAccount");

  if (!checkAccount) {
    return NextResponse.json({ available: false });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: checkAccount },
  });

  return NextResponse.json({ available: !existingUser });
}

// POST: 註冊新帳號 (account)
export async function POST(request: Request) {
  try {
    const { account, password } = await request.json();

    // 1. 驗證基本輸入
    if (!account || !password) {
      return NextResponse.json(
        { error: "請填寫帳號與密碼! Please fill in both username and password" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密碼長度至少需 6 個字元! Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // 2. 檢查帳號 (account) 是否已被註冊
    const existingUser = await prisma.user.findUnique({
      where: { email: account },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "此帳號已被註冊，請換一個帳號名稱! Please try another one" },
        { status: 400 }
      );
    }

    // 3. 密碼鹽值哈希 (bcrypt 加密)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. 建立新使用者
    const newUser = await prisma.user.create({
      data: {
        email: account,
        password: hashedPassword,
        name: account, // 名字直接預設為帳號名稱
      },
    });

    return NextResponse.json(
      {
        message: "註冊成功！Success Enjoy!",
        user: { id: newUser.id, account: newUser.email, name: newUser.name },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("註冊失敗!Failed Please try again!", error);
    return NextResponse.json(
      { error: "伺服器錯誤，請稍後再試! Please try again later" },
      { status: 500 }
    );
  }
}