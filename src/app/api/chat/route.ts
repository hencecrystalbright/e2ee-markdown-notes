import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: 取得目前使用者的所有筆記
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const notes = await prisma.note.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(notes);
  } catch (error) {
    return NextResponse.json({ error: "無法取得筆記" }, { status: 500 });
  }
}

// POST: 建立新筆記
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const { title, content, isEncrypted, tags } = await request.json();

    const newNote = await prisma.note.create({
      data: {
        userId: session.user.id,
        title: title || "無標題筆記",
        content: content || "",
        isEncrypted: isEncrypted || false,
        tags: tags || [], // 👈 支援儲存 tags
      },
    });

    return NextResponse.json(newNote);
  } catch (error) {
    console.error("建立筆記失敗:", error);
    return NextResponse.json({ error: "建立筆記失敗" }, { status: 500 });
  }
}