import fetch from "node-fetch";

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" }),
  });
}

async function callNvidiaNim(promptText) {
  const apiKey = process.env.NVIDIA_API_KEY;
  
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-v4.1-flash", // المعرف الصحيح المعتمد في NVIDIA NIM
        messages: [
          { role: "system", content: "أنت مساعد تقني ومطور برمجيات. أجب باختصار ودقة بالعربية." },
          { role: "user", content: promptText }
        ],
        temperature: 0.6,
        max_tokens: 512,
        stream: false
      })
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error("NVIDIA Error:", rawText);
      return `عذراً، خطأ من خادم NVIDIA (${response.status}): ${rawText.slice(0, 100)}`;
    }

    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      return content.trim();
    }

    return "لم يتم استلام نص من النموذج.";

  } catch (err) {
    console.error("Fetch Exception Details:", err);
    return `عذراً، حدث خطأ تقني: ${err.message}`;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ status: "HeliosPilot is online!" });
  }

  try {
    const payload = req.body;

    if (payload.message && payload.message.text) {
      const userText = payload.message.text;
      const chatId = payload.message.chat.id;

      const replyText = await callNvidiaNim(userText);
      await sendTelegramMessage(chatId, replyText);

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Handler Error:", error);
    return res.status(200).json({ error: error.message });
  }
}
