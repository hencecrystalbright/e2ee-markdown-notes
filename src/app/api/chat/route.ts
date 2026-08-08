import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "🔒 未授權，請先登入後使用 AI 功能" }, { status: 401 });
    }

    const { messages, noteContext } = await request.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("❌ 錯誤：尚未在 .env 或 Vercel 設定 DEEPSEEK_API_KEY");
      return NextResponse.json({ error: "❌ 伺服器尚未配置 DeepSeek API Key" }, { status: 500 });
    }

    const systemPrompt = {
      role: "system",
      content: `你是一個專業、親切的筆記助理 TurtleAI 🐢。請根據使用者提供的筆記內容進行分析、摘要或回答。
以下是使用者當前編輯的筆記內容：
---
${noteContext || "（目前筆記為空）"}
---`
    };

    const apiMessages = [systemPrompt, ...messages];

    // 呼叫 DeepSeek API
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: apiMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ DeepSeek API 回應異常 (${response.status}):`, errorText);

      if (response.status === 402) {
        return NextResponse.json({ error: "❌ DeepSeek API 帳戶額度不足，請至官網儲值" }, { status: 402 });
      }

      return NextResponse.json({ error: `❌ AI 服務異常 (${response.status})` }, { status: response.status });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "無回應內容";

    return NextResponse.json({ reply });

  } catch (error) {
    console.error("❌ /api/chat 內部錯誤:", error);
    return NextResponse.json({ error: "❌ 伺服器內部錯誤，請稍後再試" }, { status: 500 });
  }
}