import { Groq } from "groq-sdk";
import fetch from "node-fetch";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const memoryFilePath = path.join(__dirname, 'memory.json');

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

async function callGroqModel(systemInstruction, userPrompt) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ],
    model: "qwen/qwen3.8-27b",
    temperature: 0.5,
    max_completion_tokens: 512,
    top_p: 0.95,
  });
  return chatCompletion.choices[0]?.message?.content?.trim();
}

async function callOpenRouterModel(systemInstruction, userPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API key is not set");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "google/gemini-flash-1.5",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 512
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenRouter error");
  return data.choices[0]?.message?.content?.trim();
}

async function callAIModel(userPrompt) {
  const currentMemory = loadMemory();
  const systemInstruction = `أنت HeliosPilot، مساعد ذكاء اصطناعي تقني صُممت بواسطة (Ismail-Benali) المعروف بـ (H3l!0s_T3k) لمساعدته في تطوير مشاريعه.
الذاكرة: ${JSON.stringify(currentMemory)}
قواعد الرد: أجب باختصار واحترافية تقنية تامة باللغة العربية، ولا تقم بالمجاملة.`;

  try {
    return await callGroqModel(systemInstruction, userPrompt);
  } catch (groqError) {
    try {
      return await callOpenRouterModel(systemInstruction, userPrompt);
    } catch (openRouterError) {
      return `عذراً، حدث خطأ في خدمات الذكاء الاصطناعي.`;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ status: "HeliosPilot is online!" });
  }

  try {
    const event = req.headers["x-github-event"];
    const payload = req.body;

    if (event === "issues" && payload.action === "opened") {
      const issueTitle = payload.issue.title;
      const issueBody = payload.issue.body || "لا يوجد وصف";
      const issueUrl = payload.issue.html_url;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      const aiReply = await callAIModel(`تحليل Issue جديدة:\nالعنوان: ${issueTitle}\nالوصف: ${issueBody}`);
      await sendTelegramMessage(chatId, `🚨 *Issue جديدة تم رصدها!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل HeliosPilot:* \n${aiReply}`);

      return res.status(200).json({ success: true });
    }

    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const userTextLower = userText.toLowerCase();
      const chatId = payload.message.chat.id;

      // 1. الأوامر السريعة
      if (userText === "/start" || userText === "/help") {
        const welcomeText = `👋 أهلاً بك يا H3l!0s_T3k!\n\nأنا **HeliosPilot** صممني (Ismail-Benali) المعروف بـ **H3l!0s_T3k** لمساعدته في تطوير مشاريعه التقنية، وكذالك دوري هو مساعدتك في إدارة الأكواد وتحليل المشكلات.`;
        await sendTelegramMessage(chatId, welcomeText);
        return res.status(200).json({ success: true });
      }

      if (userText === "/memory") {
        const memory = loadMemory();
        const memoryReport = `🧠 **سجل ذاكرة HeliosPilot:**\n\n` +
          `- **المنشئ:** \`${memory.creator}\`\n` +
          `- **المشروع:** ${memory.projectName}\n` +
          `- **التقنيات:** ${memory.coreStack}`;
        await sendTelegramMessage(chatId, memoryReport);
        return res.status(200).json({ success: true });
      }

      if (userText === "/clear") {
        await sendTelegramMessage(chatId, "🧹 تم إعادة تهيئة المحادثة الحالية.");
        return res.status(200).json({ success: true });
      }

      // 2. الرد الفوري والدقيق على أسئلة الهوية ومن صممه (بدون الاعتماد على مزاج الموديل)
      if (
        userTextLower.includes("من أنت") || 
        userTextLower.includes("من انت") || 
        userTextLower.includes("من صممك") || 
        userTextLower.includes("من انشئك") ||
        userTextLower.includes("من أنشأك") ||
        userTextLower.includes("who are you")
      ) {
        const identityResponse = `أنا **HeliosPilot** صممني (Ismail-Benali) المعروف بـ **H3l!0s_T3k** لمساعدته في تطوير مشاريعه التقنية، وكذالك دوري هو مساعدتك في إدارة الأكواد، تحليل مشكلات GitHub، وتقديم الدعم التقني بدقة واختصار.`;
        await sendTelegramMessage(chatId, identityResponse);
        return res.status(200).json({ success: true });
      }

      // 3. الرد على التحيات البسيطة (مثل مرحبا أو hello)
      if (userTextLower === "مرحبا" || userTextLower === "سلام" || userTextLower === "hello" || userTextLower === "hi") {
        await sendTelegramMessage(chatId, "أهلاً بك يا H3l!0s_T3k. أنا HeliosPilot، جاهز لمساعدتك في أي مهمة برمجية. ما المطلوب؟");
        return res.status(200).json({ success: true });
      }

      // 4. باقي الأسئلة التقنية تُرسل للذكاء الاصطناعي
      const replyText = await callAIModel(userText);
      await sendTelegramMessage(chatId, replyText);

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Handler Error:", error);
    return res.status(200).json({ error: error.message });
  }
}
