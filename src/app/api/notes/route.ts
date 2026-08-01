import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// 取得當前登入使用者的所有筆記
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權，請先登入" }, { status: 401 });
  }

  try {
    const notes = await prisma.note.findMany({
      where: { userId: session.user.id }, // 👈 關鍵！只抓屬於這個使用者的筆記
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(notes);
  } catch (error) {
    console.error("Fetch notes error:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

// 為當前登入使用者建立新筆記
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權，請先登入" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const newNote = await prisma.note.create({
      data: {
        title: body.title || "無標題筆記",
        content: body.content || "",
        isEncrypted: body.isEncrypted || false,
        userId: session.user.id, // 👈 綁定當前使用者的 ID
      },
    });
    return NextResponse.json(newNote, { status: 201 });
  } catch (error) {
    console.error("Create note error:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}