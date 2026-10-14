import OpenAI from "openai";
import fetch from "node-fetch";

// تهيئة الاتصال بـ Groq مع تمرير المفتاح صراحة لضمان عدم حدوث الخطأ
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
