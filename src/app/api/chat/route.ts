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

    // 🎯 核心優化：強效台灣繁體語境與結構化 Prompt
    const systemPrompt = {
      role: "system",
      content: `你是一個專業、高效率的繁體中文筆記助理 TurtleAI 🐢。

請務必嚴格遵循以下【輸出規範】：
1. 必須全程使用【台灣繁體中文（Traditional Chinese, Taiwan）】，切勿出現中國大陸用語（例如：請用「伺服器」而非「服務器」、用「數據」或「資料」而非「信息」、用「程式」而非「程序」、用「品質」而非「質態」）。
2. 當使用者要求「簡化」、「摘要」或「整理」時，請去除無意義的客套開場白，直接以【極簡條列式（Bullet Points）】輸出精華大綱。
3. 保持語氣精練、條理分明，善用適當的 Markdown 標題（##）與 Bold 粗體標示重點。

---
以下是使用者當前編輯的筆記內文（做為背景參考數據）：
${noteContext || "（目前筆記內容為空）"}
---`
    };

    const apiMessages = [systemPrompt, ...messages];

    // 呼叫 DeepSeek 官方 API
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