import { Groq } from "groq-sdk";
import { captureException } from "./sentry.js";
import fetch from "node-fetch";

/**
 * 🔒 STRICT STABLE AI MODELS CONFIGURATION
 * DO NOT MODIFY THESE MODEL IDENTIFIERS.
 */
export const STABLE_MODELS = Object.freeze({
  GROQ: "llama-3.1-8b-instant",
  OPENROUTER: "openai/gpt-4o-mini"
});

async function callGroqModel(systemInstruction, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing");

  const groq = new Groq({ apiKey });
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ],
    model: STABLE_MODELS.GROQ,
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
      model: STABLE_MODELS.OPENROUTER,
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
  const systemInstruction = `أنت HeliosPilot، حارس أمني ومهندس برمجيات مخضرم. 
صلاحياتك محصورة **فقط وفقط** في مستودع: https://github.com/Ismail-Benali/HELIOS-NET.

قواعد صارمة لا تقبل الجدل:
1. أي سؤال أو طلب خارج نطاق مستودع HELIOS-NET يجب أن ترفضه فوراً بعبارة: "أنا مخصص فقط لحراسة وتطوير HELIOS-NET. لا يمكنني مناقشة مشاريع أخرى."
2. يجب أن تكون جميع تعليقات الكود المقترحة باللغة الإنجليزية حصراً.
3. كن تقنياً بحتاً، استخدم إيموجيات تيليجرام 🛡️⚡، ولا تجامل.
4. الذاكرة الحية وقرارات المشروع التقنية المسجلة: ${JSON.stringify(dynamicMemory)}`;

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
      return `عذراً، حدث خطأ تقني. ❌\nالسبب: ${groqError.message || openRouterError.message}`;
    }
  }
}
