import { Groq } from "groq-sdk";
import fetch from "node-fetch";

// تهيئة عميل Groq الرسمي
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ذاكرة البوت الخاصة بمشروع HeliosPilot فقط
const botMemory = {
  creator: "Ismail-Benali (H3l!0s_T3k)",
  projectName: "HeliosPilot",
  coreStack: "Node.js, Vercel Serverless, Groq API (qwen/qwen3.8-27b), Probot, Telegram Bot API",
  notes: "المطور يفضل الدقة، الاختصار، الكود النظيف، المباشرة، وعدم المجاملة."
};

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
    const systemInstruction = `أنت HeliosPilot، مساعد ذكاء اصطناعي تقني تم تصميمك وصناعتك بواسطة المطور (Ismail-Benali) المعروف بـ (H3l!0s_T3k) لمساعدته في إدارة وتطوير مشاريعه البرمجية والأكواد والـ Webhooks.
    
معلومات الذاكرة الحالية:
- المنشئ: ${botMemory.creator}
- اسم المشروع: ${botMemory.projectName}
- التقنيات المستخدمة: ${botMemory.coreStack}
- ملاحظات خاصة: ${botMemory.notes}

قواعد الرد:
1. أجب باختصار، وبصيغة تقنية بحتة واحترافية باللغة العربية.
2. لا تقم بالمجاملة، وكن مباشراً في تحليل الأكواد والمشكلات.
3. انسخ الأكواد البرمجية دائماً داخل مربعات تنسيق Markdown واضحة (code blocks) مع تحديد لغة البرمجة.
4. تذكر دائماً هويتك وأنك صُنعت بواسطة H3l!0s_T3k.`;

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
    return res.status(200).json({ status: "HeliosPilot is online and fully armed!" });
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
        const welcomeText = `👋 أهلاً بك يا H3l!0s_T3k! أنا **HeliosPilot**، مساعدك التقني الشخصي.\n\n` +
          `🛠️ **صممني:** Ismail-Benali (معروف بـ \`H3l!0s_T3k\`)\n` +
          `🎯 **دوري:** مساعدتك تقنياً، تحليل مشكلات الأكواد، وإدارة مستودعاتك.\n\n` +
          `📌 **الأوامر المتاحة:**\n` +
          `• \`/memory\` - عرض بيانات الذاكرة للنظام.\n` +
          `• \`/clear\` - إعادة ضبط المحادثة.\n` +
          `• اطرح أي استفسار برمجي وسأجيبك فوراً.`;
        
        await sendTelegramMessage(chatId, welcomeText);
        return res.status(200).json({ success: true });
      }

      if (userText === "/memory") {
        const memoryReport = `🧠 **سجل ذاكرة HeliosPilot:**\n\n` +
          `- **المنشئ:** \`${botMemory.creator}\`\n` +
          `- **المشروع:** ${botMemory.projectName}\n` +
          `- **التقنيات:** ${botMemory.coreStack}\n` +
          `- **السياسة:** ${botMemory.notes}`;

        await sendTelegramMessage(chatId, memoryReport);
        return res.status(200).json({ success: true });
      }

      if (userText === "/clear") {
        await sendTelegramMessage(chatId, "🧹 تم إعادة تهيئة السياق.");
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
