import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: Request) {
  // 1. 驗證使用者權限
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權，請先登入" }, { status: 401 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "伺服器未設定 DEEPSEEK_API_KEY" }, { status: 500 });
  }

  try {
    const { messages, noteContext } = await request.json();

    // 2. 構建 System Prompt（設定小烏龜 AI 助手的個性與筆記上下文）
    let systemPrompt = "你是一位精通 Markdown 的 AI 筆記助手『 TurtleAI 』。請用繁體中文回答，口吻親切且富有條理。";
    
    if (noteContext && noteContext.trim()) {
      systemPrompt += `\n\n【當前使用者正在檢視的筆記內容如下】：\n"""\n${noteContext}\n"""\n如果使用者的問題與筆記相關，請參考上述內容回答。`;
    }

    const payloadMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // 3. 呼叫 DeepSeek API (使用深受好評且極便宜的 deepseek-chat 模型)
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: payloadMessages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API 錯誤:", errorText);
      return NextResponse.json({ error: "DeepSeek API 呼叫失敗" }, { status: response.status });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "抱歉，AI 暫時無法回應。";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "伺服器內部錯誤" }, { status: 500 });
  }
}