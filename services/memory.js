import { kv } from '@vercel/kv';
import { captureException } from './sentry.js';

export const DEFAULT_MEMORY = {
  creator: "Ismail-Benali (H3l!0s_T3k)",
  projectName: "HELIOS-NET & HeliosPilot Ecosystem",
  coreStack: "Node.js, Vercel Serverless, Groq, OpenRouter, GitHub App, Telegram API, Vercel KV, Sentry",
  rules: "أنت خبير مخضرم بخبرة 25 عاماً في هندسة النظم، أمن المعلومات، ASM، و DevSecOps.",
  targetProject: "https://github.com/Ismail-Benali/HELIOS-NET",
  dynamicMemory: [],
  userActiveRepos: {},
  admins: []
};

export async function getRuntimeMemory() {
  try {
    const mem = await kv.get("helios_runtime_memory");
    return mem ? mem : DEFAULT_MEMORY;
  } catch (err) {
    captureException(err, { context: "getRuntimeMemory" });
    return DEFAULT_MEMORY;
  }
}

export async function saveRuntimeMemory(mem) {
  try {
    await kv.set("helios_runtime_memory", mem);
  } catch (err) {
    captureException(err, { context: "saveRuntimeMemory" });
  }
}

export async function getTeamMemory(chatId) {
  try {
    const mem = await kv.get(`team_memory_${chatId}`);
    return mem ? mem : { ...DEFAULT_MEMORY, dynamicMemory: [], userActiveRepos: {}, admins: [] };
  } catch (err) {
    captureException(err, { context: "getTeamMemory" });
    return { ...DEFAULT_MEMORY, dynamicMemory: [], userActiveRepos: {}, admins: [] };
  }
}

export async function saveTeamMemory(chatId, mem) {
  try {
    await kv.set(`team_memory_${chatId}`, mem);
  } catch (err) {
    captureException(err, { context: "saveTeamMemory" });
  }
}

export function isAdmin(chatId, memory) {
  return (memory.admins && memory.admins.includes(chatId.toString())) || chatId.toString() === process.env.TELEGRAM_CHAT_ID;
}

export async function saveToErrorKB(errorMessage, solution, repo) {
  const kb = await kv.get("global_error_kb") || {};
  if (!kb[errorMessage]) kb[errorMessage] = [];
  kb[errorMessage].push({ solution, repo, timestamp: Date.now() });
  await kv.set("global_error_kb", kb);
}

export async function getSolutionFromKB(errorMessage) {
  const kb = await kv.get("global_error_kb") || {};
  return kb[errorMessage] || [];
}
