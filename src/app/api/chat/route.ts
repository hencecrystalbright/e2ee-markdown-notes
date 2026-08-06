import { NextResponse } from "next/server";
import { auth } from "@/auth";

// 記憶體中記錄每位使用者當天的使用次數與日期
// 格式：{ "userId_2026-08-06": count }
const usageTracker = new Map<string, number>();

// 🎯 設定每人每天的最大提問次數 (已調整為 10 次)
const DAILY_LIMIT = 10;

export async function POST(request: Request) {
  // 1. 驗證使用者權限
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權，請先登入" }, { status: 401 });
  }

  const userId = session.user.id;
  const todayStr = new Date().toISOString().split("T")[0]; // 取得 YYYY-MM-DD
  const trackerKey = `${userId}_${todayStr}`;

  // 2. 檢查當日使用次數
  const currentUsage = usageTracker.get(trackerKey) || 0;

  if (currentUsage >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `⚠️ Out of AI token today (${DAILY_LIMIT}/${DAILY_LIMIT} 次) ，Please try again tomorrow！` },
      { status: 429 }
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "伺服器未設定 DEEPSEEK_API_KEY" }, { status: 500 });
  }

  try {
    const { messages, noteContext } = await request.json();

    // 3. 構建 System Prompt
    let systemPrompt = "你是一位精通 Markdown 的 AI 筆記助手『 TurtleAI 』。請用繁體中文回答，口吻親切且富有條理。";
    
    if (noteContext && noteContext.trim()) {
      systemPrompt += `\n\n【當前使用者正在檢視的筆記內容如下】：\n"""\n${noteContext}\n"""\n如果使用者的問題與筆記相關，請參考上述內容回答。`;
    }

    const payloadMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // 4. 呼叫 DeepSeek API (已設定 max_tokens: 2048)
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
        max_tokens: 2048, // 👈 限制單次回應最大長度為 2048 tokens
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API 錯誤:", errorText);
      return NextResponse.json({ error: "DeepSeek API 呼叫失敗，請檢查金鑰或餘額" }, { status: response.status });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "抱歉，AI 暫時無法回應。";

    // 5. 成功完成呼叫後，累加當日使用次數
    usageTracker.set(trackerKey, currentUsage + 1);

    return NextResponse.json({ 
      reply,
      usage: {
        used: currentUsage + 1,
        limit: DAILY_LIMIT,
        remaining: DAILY_LIMIT - (currentUsage + 1)
      }
    });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "伺服器內部錯誤" }, { status: 500 });
  }
}