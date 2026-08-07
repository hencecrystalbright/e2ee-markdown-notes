import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PUT: 更新單一筆記
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const { title, content, isEncrypted, tags } = await request.json();

    const updatedNote = await prisma.note.update({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: {
        title,
        content,
        isEncrypted,
        tags: tags || [], // 👈 支援更新 tags
      },
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    return NextResponse.json({ error: "更新筆記失敗" }, { status: 500 });
  }
}

// DELETE: 刪除單一筆記
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    await prisma.note.delete({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "刪除筆記失敗" }, { status: 500 });
  }
}