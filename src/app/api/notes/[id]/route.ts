import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // 👈 修正 TypeScript 型別驗證
    const body = await request.json();
    
    const updatedNote = await prisma.note.update({
      where: { id },
      data: {
        title: body.title,
        content: body.content,
        isEncrypted: body.isEncrypted,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error("PUT API Error:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // 👈 修正 TypeScript 型別驗證
    await prisma.note.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE API Error:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}