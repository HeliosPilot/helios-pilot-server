import OpenAI from "openai";
import fetch from "node-fetch";

// إعداد اتصال DeepSeek عبر NVIDIA NIM
const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// وظيفة لإرسال الرسائل إلى Telegram
async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" }),
  });
}

export default async (req, res) => {
  try {
    const event = req.headers["x-github-event"];
    const payload = req.body;

    // 1. التعامل مع أحداث GitHub (مثل فتح Issue جديدة)
    if (event === "issues" && payload.action === "opened") {
      const issueTitle = payload.issue.title;
      const issueBody = payload.issue.body || "لا يوجد وصف";
      const issueUrl = payload.issue.html_url;

      // طلب التحليل من DeepSeek
      const completion = await openai.chat.completions.create({
        model: "deepseek-ai/deepseek-r1",
        messages: [
          { role: "system", content: "أنت مساعد تقني ذكي لمدير المشاريع في مستودع HELIOS-NET. قم بتحليل المشكلة واقترح حلاً تقنياً مختصراً بالعربية." },
          { role: "user", content: `العنوان: ${issueTitle}\nالوصف: ${issueBody}` }
        ],
        temperature: 0.5,
        max_tokens: 1024,
      });

      const aiReply = completion.choices[0].message.content;

      // إرسال تنبيه مع الحل إلى Telegram
      await sendTelegramMessage(`🚨 *تم رصد Issue جديدة!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل واقتراح الذكاء الاصطناعي:* \n${aiReply}`);

      return res.status(200).json({ status: "Processed GitHub Issue & Sent Telegram Alert" });
    }

    // 2. التعامل مع رسائل Telegram الواردة (محادثة مباشرة مع البوت)
    if (payload.message && payload.message.text) {
      const userText = payload.message.text;
      
      // إرسال السؤال إلى DeepSeek
      const completion = await openai.chat.completions.create({
        model: "deepseek-ai/deepseek-r1",
        messages: [
          { role: "system", content: "أنت مساعد تقني ذكي لمالك المستودعات والمطور. أجب عن الأسئلة التقنية والبرمجية باحترافية وبشكل مختصر." },
          { role: "user", content: userText }
        ],
        temperature: 0.5,
        max_tokens: 1024,
      });

      const replyText = completion.choices[0].message.content;
      await sendTelegramMessage(replyText);

      return res.status(200).json({ status: "Processed Telegram Message" });
    }

    return res.status(200).json({ message: "HeliosPilot is online and listening!" });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
