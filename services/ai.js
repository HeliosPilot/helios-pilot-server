import { Groq } from "groq-sdk";
import { captureException } from "./sentry.js";
import fetch from "node-fetch";

async function callGroqModel(systemInstruction, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing");

  const groq = new Groq({ apiKey });
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ],
    model: "deepseek-r1-distill-llama-70b",
    temperature: 0.3,
    max_completion_tokens: 1024,
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
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1024
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenRouter error");
  return data.choices[0]?.message?.content?.trim();
}

export async function processSmartAIResponse(userPrompt, dynamicMemory = []) {
  const systemInstruction = `أنت HeliosPilot، خبير مخضرم بخبرة 25 عاماً في هندسة النظم، أمن المعلومات، ASM، و DevSecOps. تم تصميمك وتخصيصك حصرياً لحراسة وتطوير مشروع HELIOS-NET (https://github.com/Ismail-Benali/HELIOS-NET).
خالقك ومالكك هو (Ismail-Benali) المعروف بـ (H3l!0s_T3k).
الذاكرة الحية وقرارات المشروع التقنية المسجلة: ${JSON.stringify(dynamicMemory)}

قواعد العمل الصارمة جداً:
1. أنت خبير تقني عالي الاحترافية. عند كتابة أو اقتراح أي أكواد برمجية، يجب أن تكون التعليقات داخل الكود (Code Comments) مكتوبة **باللغة الإنجليزية حصراً** ووفقاً لأرقى المعايير العالمية (Enterprise Standards).
2. استخدم الإيموجيات المعبرة بحيوية في ردودك على تيليجرام (مثل ⚡, 🛡️, 🔥, 🧠, 🚀, 💡) لتعكس ديناميكية وقوة الحراسة.
3. كن دقيقاً، صارماً، تقنياً بحتاً، وباللغة العربية الفصحى للرد على المستخدِم، بدون أي مجاملة فارغة.`;

  try {
    return await callGroqModel(systemInstruction, userPrompt);
  } catch (groqError) {
    console.error("Groq AI Error Details:", groqError);
    captureException(groqError, { context: "callGroqModel" });
    try {
      return await callOpenRouterModel(systemInstruction, userPrompt);
    } catch (openRouterError) {
      console.error("OpenRouter AI Error Details:", openRouterError);
      captureException(openRouterError, { context: "callOpenRouterModel" });
      return `عذراً، حدث خطأ في خدمات الذكاء الاصطناعي. ❌\nالسبب التقني: ${groqError.message || openRouterError.message}`;
    }
  }
}
