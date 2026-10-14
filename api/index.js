import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
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
      model: "deepseek-ai/deepseek-r1",
      messages: [
        { role: "system", content: "أنت مساعد تقني ومطور برمجيات. أجب باختصار ودقة بالعربية." },
        { role: "user", content: promptText }
      ],
      temperature: 0.5,
      max_tokens: 512,
    });

    const content = completion.choices[0]?.message?.content || "";
    
    // إزالة وسوم التفكير الخاصة بـ DeepSeek ليكون الرد نظيفاً على تلغرام
    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return cleanContent || content;

  } catch (error) {
    console.error("OpenAI/NVIDIA Error:", error);
    return `عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي: ${error.message}`;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ status: "HeliosPilot is online!" });
  }

  try {
    const event = req.headers["x-github-event"];
    const payload = req.body;

    // 1. التعامل مع أحداث GitHub (Issues)
    if (event === "issues" && payload.action === "opened") {
      const issueTitle = payload.issue.title;
      const issueBody = payload.issue.body || "لا يوجد وصف";
      const issueUrl = payload.issue.html_url;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      const aiReply = await callNvidiaNim(`العنوان: ${issueTitle}\nالوصف: ${issueBody}`);
      await sendTelegramMessage(chatId, `🚨 *Issue جديدة!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل الذكاء الاصطناعي:* \n${aiReply}`);

      return res.status(200).json({ success: true });
    }

    // 2. التعامل مع رسائل Telegram المباشرة
    if (payload.message && payload.message.text) {
      const userText = payload.message.text;
      const chatId = payload.message.chat.id;

      const replyText = await callNvidiaNim(userText);
      await sendTelegramMessage(chatId, replyText);

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Critical Handler Error:", error);
    return res.status(200).json({ error: error.message });
  }
}
