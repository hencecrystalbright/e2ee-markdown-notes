import { NextResponse } from 'next/server';

// PUT: 更新單筆筆記
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // 改成 Promise
) {
  try {
    const { id } = await params; // 加上 await
    const body = await request.json();

    console.log(`更新筆記 ${id}:`, body);

    return NextResponse.json({
      id,
      ...body,
      updatedAt: new Date().toISOString().split("T")[0],
    });
  } catch (error) {
    return NextResponse.json({ error: "更新筆記失敗" }, { status: 500 });
  }
}

// DELETE: 刪除單筆筆記
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // 改成 Promise
) {
  try {
    const { id } = await params; // 加上 await
    console.log(`刪除筆記 ${id}`);

    return NextResponse.json({ message: "筆記刪除成功", id });
  } catch (error) {
    return NextResponse.json({ error: "刪除筆記失敗" }, { status: 500 });
  }
}