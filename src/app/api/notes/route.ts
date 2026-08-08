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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
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
    return NextResponse.json({ error: "建立筆記失敗" }, { status: 500 });
  }
}