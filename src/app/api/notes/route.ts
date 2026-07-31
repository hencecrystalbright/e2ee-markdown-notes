import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const notes = await prisma.note.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(notes);
  } catch (error) {
    console.error("GET API Error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Response | Request) {
  try {
    const body = await request.json();
    const newNote = await prisma.note.create({
      data: {
        title: body.title || "無標題筆記",
        content: body.content || "",
        isEncrypted: body.isEncrypted || false,
      },
    });
    return NextResponse.json(newNote);
  } catch (error) {
    console.error("POST API Error:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}