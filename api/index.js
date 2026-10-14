import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
  timeout: 15000, // مهلة 15 ثانية لمكتبة OpenAI
});

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
  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-ai/deepseek-v4.1-flash",
      messages: [
        { role: "system", content: "أنت مساعد تقني. أجب باختصار ومباشرة بالعربية." },
        { role: "user", content: promptText }
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content;
    return content ? content.trim() : "لم يتم استلام رد.";

  } catch (error) {
    console.error("OpenAI SDK Connection Error:", error);
    if (error.code === 'ETIMEDOUT' || error.status === 404) {
      return "عذراً، تعذر الوصول إلى خادم NVIDIA (انانتهى الوقت أو خطأ في الاتصال).";
    }
    return `عذراً، حدث خطأ: ${error.message}`;
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
