import { Groq } from "groq-sdk";
import fetch from "node-fetch";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// إعداد المسارات لقراءة ملف الذاكرة محلياً
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const memoryFilePath = path.join(__dirname, 'memory.json');

// دالة لقراءة الذاكرة الحالية من ملف JSON
function loadMemory() {
  try {
    if (fs.existsSync(memoryFilePath)) {
      const data = fs.readFileSync(memoryFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading memory file:", error);
  }
  return {
    creator: "Ismail-Benali (H3l!0s_T3k)",
    projectName: "HeliosPilot",
    coreStack: "Node.js, Vercel Serverless, Groq API",
    notes: "دقيق ومباشر.",
    dynamicMemory: []
  };
}

// تهيئة عميل Groq
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

async function callGroqModel(userPrompt) {
  try {
    const currentMemory = loadMemory();

    const systemInstruction = `أنت HeliosPilot، مساعد ذكاء اصطناعي تقني صُممت بواسطة (Ismail-Benali) المعروف بـ (H3l!0s_T3k).
    
الذاكرة الحالية للنظام:
- المنشئ: ${currentMemory.creator}
- اسم المشروع: ${currentMemory.projectName}
- التقنيات: ${currentMemory.coreStack}
- ملاحظات ثابتة: ${currentMemory.notes}
- ذاكرة ديناميكية إضافية: ${JSON.stringify(currentMemory.dynamicMemory)}

قواعد الرد:
1. أجب باختصار واحترافية تقنية تامة باللغة العربية.
2. لا تقم بالمجاملة وكن مباشراً.
3. إذا طلب منك المستخدم تذكر معلومة جديدة أو تعديل الذاكرة، قم بصياغة المعلومة الجديدة بوضوح واقترح عليه تحديث ملف memory.json بها بالشكل المناسب.
4. استخدم مربعات الأكواد (code blocks) عند كتابة البرمجة.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      model: "qwen/qwen3.8-27b",
      temperature: 0.5,
      max_completion_tokens: 2048,
      top_p: 0.95,
      stream: false,
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
    return res.status(200).json({ status: "HeliosPilot is online with Dynamic Memory support!" });
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

      const aiReply = await callGroqModel(`تحليل Issue جديدة:\nالعنوان: ${issueTitle}\nالوصف: ${issueBody}`);
      await sendTelegramMessage(chatId, `🚨 *Issue جديدة تم رصدها!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل HeliosPilot:* \n${aiReply}`);

      return res.status(200).json({ success: true });
    }

    // 2. التعامل مع رسائل Telegram المباشرة والأوامر
    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const chatId = payload.message.chat.id;

      if (userText === "/start" || userText === "/help") {
        const welcomeText = `👋 أهلاً بك يا H3l!0s_T3k! أنا **HeliosPilot**.\n\n` +
          `🛠️ **صممني:** Ismail-Benali (\`H3l!0s_T3k\`)\n` +
          `🧠 **المميزات:** أقرأ الذاكرة من ملفات المستودع وأتطور معك.\n\n` +
          `📌 **الأوامر:**\n` +
          `• \`/memory\` - عرض الذاكرة الحالية.\n` +
          `• \`/clear\` - إعادة ضبط السياق.`;
        
        await sendTelegramMessage(chatId, welcomeText);
        return res.status(200).json({ success: true });
      }

      if (userText === "/memory") {
        const memory = loadMemory();
        const memoryReport = `🧠 **سجل ذاكرة HeliosPilot:**\n\n` +
          `- **المنشئ:** \`${memory.creator}\`\n` +
          `- **المشروع:** ${memory.projectName}\n` +
          `- **التقنيات:** ${memory.coreStack}\n` +
          `- **الذاكرة الديناميكية:** ${JSON.stringify(memory.dynamicMemory)}`;

        await sendTelegramMessage(chatId, memoryReport);
        return res.status(200).json({ success: true });
      }

      if (userText === "/clear") {
        await sendTelegramMessage(chatId, "🧹 تم إعادة تهيئة المحادثة الحالية.");
        return res.status(200).json({ success: true });
      }

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
