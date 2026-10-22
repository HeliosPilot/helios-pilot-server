import { kv } from './kv';
import { captureException } from './sentry';
import type { HeliosMemory } from '../types/memory';

export const DEFAULT_MEMORY: HeliosMemory = {
  creator: "Ismail-Benali (H3l!0s_T3k)",
  projectName: "HELIOS-NET & HeliosPilot Ecosystem",
  coreStack: "Node.js, Vercel Serverless, Groq, OpenRouter, GitHub App, Telegram API, Vercel KV, Sentry",
  rules: "أنت خبير مخضرم بخبرة 25 عاماً في هندسة النظم، أمن المعلومات، ASM، و DevSecOps.",
  targetProject: "https://github.com/Ismail-Benali/HELIOS-NET",
  dynamicMemory: [],
  userActiveRepos: {},
  admins: []
};

function emptyMemory(): HeliosMemory {
  return { ...DEFAULT_MEMORY, dynamicMemory: [], userActiveRepos: {}, admins: [] };
}

export async function getRuntimeMemory(): Promise<HeliosMemory> {
  try {
    const mem = (await kv.get('helios_runtime_memory')) as HeliosMemory | null;
    return mem || emptyMemory();
  } catch (err) {
    captureException(err, { context: "getRuntimeMemory" });
    return emptyMemory();
  }
}

export async function saveRuntimeMemory(mem: HeliosMemory): Promise<boolean> {
  try {
    await kv.set("helios_runtime_memory", mem);
    return true;
  } catch (err) {
    captureException(err, { context: "saveRuntimeMemory" });
    return false;
  }
}

export async function getTeamMemory(chatId: string | number): Promise<HeliosMemory> {
  try {
    const mem = (await kv.get(`team_memory_${chatId}`)) as HeliosMemory | null;
    return mem || emptyMemory();
  } catch (err) {
    captureException(err, { context: "getTeamMemory" });
    return emptyMemory();
  }
}

export async function saveTeamMemory(chatId: string | number, mem: HeliosMemory): Promise<boolean> {
  try {
    await kv.set(`team_memory_${chatId}`, mem);
    return true;
  } catch (err) {
    captureException(err, { context: "saveTeamMemory" });
    return false;
  }
}

export function isAdmin(chatId: string | number, memory: { admins?: string[] }): boolean {
  return Boolean(memory.admins?.includes(chatId.toString())) || chatId.toString() === process.env.TELEGRAM_CHAT_ID;
}

interface ErrorKnowledgeBase {
  [errorMessage: string]: Array<{ solution: string; repo: string; timestamp: number }>;
}

export async function saveToErrorKB(errorMessage: string, solution: string, repo: string): Promise<void> {
  const kb = ((await kv.get("global_error_kb")) as ErrorKnowledgeBase | null) || {};
  if (!kb[errorMessage]) kb[errorMessage] = [];
  kb[errorMessage].push({ solution, repo, timestamp: Date.now() });
  await kv.set("global_error_kb", kb);
}

export async function getSolutionFromKB(errorMessage: string): Promise<Array<{ solution: string; repo: string; timestamp: number }>> {
  const kb = ((await kv.get("global_error_kb")) as ErrorKnowledgeBase | null) || {};
  return kb[errorMessage] || [];
}
