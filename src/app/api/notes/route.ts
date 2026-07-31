import { NextResponse } from 'next/server';

// 暫時存放筆記的資料庫範例
let notes = [
  {
    id: "1",
    title: "歡迎使用端到端加密筆記",
    content: "# 歡迎！\n這是一份普通的公開筆記，尚未經過 AES 加密。",
    updatedAt: "2026-07-30",
    isEncrypted: false,
  },
  {
    id: "2",
    title: "敏感個人備忘錄 (已加密)",
    content: "U2FsdGVkX1+vG8P2984kM91Wf2S/H/5qUe/y1Nf34U8G9Rz+Vd4yZ1G+V1mN3R9A",
    updatedAt: "2026-07-29",
    isEncrypted: true,
  },
];

// GET: 取得所有筆記
export async function GET() {
  return NextResponse.json(notes);
}

// POST: 新增筆記
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newNote = {
      id: Date.now().toString(),
      title: body.title || "無標題筆記",
      content: body.content || "",
      updatedAt: new Date().toISOString().split("T")[0],
      isEncrypted: body.isEncrypted || false,
    };

    notes.unshift(newNote); // 加到最前面
    return NextResponse.json(newNote, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "建立筆記失敗" }, { status: 500 });
  }
}