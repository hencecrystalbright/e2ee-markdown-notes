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

    // 🛡️ 雙重防護：強硬檢查「至少 1 個英文字母」與「至少 6 個數字」
    const hasLetter = /[a-zA-Z]/.test(password);
    const digitCount = (password.match(/\d/g) || []).length;

    if (!hasLetter || digitCount < 6) {
      return NextResponse.json(
        { error: "密碼強度不符：必須包含至少 1 個英文字母與至少 6 個數字！Password must contain at least 1 letter and 6 digits." },
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

    // 4. 建立新使用者並附帶預設範例筆記
    const welcomeLines = [
      '歡迎來到你的專屬筆記空間！這是一份自動建立的生活導覽，你可以隨意修改或刪除。',
      '',
      '### 🛒 待辦清單範例（點擊可直接打勾）',
      '- [x] 成功註冊 TurtleNote',
      '- [ ] 買牛奶與雞蛋',
      '- [ ] 週末行李打包清單',
      '',
      '### 💡 專屬安全鎖功能',
      '這是一篇一般筆記。若想記錄信用卡卡號、存摺帳號或私密備忘：',
      '1. 點擊頂部的「Secret / 鎖頭」按鈕。',
      '2. 輸入一組你自己的密碼，內容就會在裝置本地完成加密。',
      '',
      '> 提示：點擊右上角「+」即可開始建立你的全新筆記！'
    ];

    const newUser = await prisma.user.create({
      data: {
        email: account,
        password: hashedPassword,
        name: account,
        notes: {
          create: {
            title: '🛒 歡迎使用 TurtleNote！快速導覽',
            content: welcomeLines.join('\n'),
            isEncrypted: false,
          },
        },
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
    console.error("註冊失敗! Failed Please try again!", error);
    return NextResponse.json(
      { error: "伺服器錯誤，請稍後再試! Please try again later" },
      { status: 500 }
    );
  }
}
