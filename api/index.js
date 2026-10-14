import { Groq } from "groq-sdk";
import fetch from "node-fetch";

// تهيئة عميل Groq الرسمي
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
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

async function callGroqModel(promptText) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "أنت مساعد تقني ومطور برمجيات. أجب باختصار ودقة بالعربية." },
        { role: "user", content: promptText }
      ],
      model: "qwen/qwen3.8-27b",
      temperature: 0.6,
      max_completion_tokens: 2048,
      top_p: 0.95,
      stream: false, // تم جعله false لتجميع الرد وإرساله دفعة واحدة لـ Telegram
      reasoning_effort: "default",
    });

    return chatCompletion.choices[0]?.message?.content?.trim() || "لم يتم استلام رد من النموذج.";

  } catch (error) {
    console.error("Groq SDK Error:", error);
    return `عذراً، حدث خطأ في خدمة الذكاء الاصطناعي: ${error.message}`;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ status: "HeliosPilot is online with Groq SDK!" });
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

      const aiReply = await callGroqModel(`العنوان: ${issueTitle}\nالوصف: ${issueBody}`);
      await sendTelegramMessage(chatId, `🚨 *Issue جديدة!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل الذكاء الاصطناعي:* \n${aiReply}`);

      return res.status(200).json({ success: true });
    }

    // 2. التعامل مع رسائل Telegram المباشرة
    if (payload.message && payload.message.text) {
      const userText = payload.message.text;
      const chatId = payload.message.chat.id;

      const replyText = await callGroqModel(userText);
      await sendTelegramMessage(chatId, replyText);

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Handler Error:", error);
    return res.status(200).json({ error: error.message });
  }
}
