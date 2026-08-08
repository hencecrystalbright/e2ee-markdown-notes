import { NextResponse } from "next/server";
import { auth } from "@/auth"; // 👈 確保直接引進 auth 驗證函式
import { prisma } from "@/lib/prisma";

// 1. 取得該使用者的所有筆記
export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "未授權，請先登入" }, { status: 401 });
    }

    const notes = await prisma.note.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("GET /api/notes 錯誤:", error);
    return NextResponse.json({ error: "伺服器內部錯誤" }, { status: 500 });
  }
}

// 2. 建立新筆記
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "未授權，請先登入" }, { status: 401 });
    }

    const body = await request.json();

    const newNote = await prisma.note.create({
      data: {
        title: body.title || "",
        content: body.content || "",
        isEncrypted: body.isEncrypted || false,
        tags: body.tags || [],
        userId: session.user.id,
      },
    });

    return NextResponse.json(newNote, { status: 201 });
  } catch (error) {
    console.error("POST /api/notes 錯誤:", error);
    return NextResponse.json({ error: "建立筆記失敗" }, { status: 500 });
  }
}