import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PUT: 更新單一筆記
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const { id } = await params; // 👈 關鍵修正：使用 await 解開 Promise
    const { title, content, isEncrypted, tags } = await request.json();

    const updatedNote = await prisma.note.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        title,
        content,
        isEncrypted,
        tags: tags || [],
      },
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error("更新筆記失敗:", error);
    return NextResponse.json({ error: "更新筆記失敗" }, { status: 500 });
  }
}

// DELETE: 刪除單一筆記
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const { id } = await params; // 👈 關鍵修正：使用 await 解開 Promise
    await prisma.note.delete({
      where: {
        id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("刪除筆記失敗:", error);
    return NextResponse.json({ error: "刪除筆記失敗" }, { status: 500 });
  }
}