import { Groq } from "groq-sdk";
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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
    coreStack: "Node.js, Vercel Serverless, Groq API, GitHub App",
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

function generateGitHubAppJWT() {
  const appId = process.env.APP_ID;
  let privateKey = process.env.PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials (APP_ID or PRIVATE_KEY) are missing.");
  }

  privateKey = privateKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + (10 * 60),
    iss: appId
  };

  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signInput = `${encodedHeader}.${encodedPayload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(privateKey, "base64url");

  return `${signInput}.${signature}`;
}

// جلب مستودعات التثبيت
async function fetchAppInstallationsAndRepos() {
  try {
    const jwtToken = generateGitHubAppJWT();
    const octokit = new Octokit({ auth: jwtToken });
    const { data: installations } = await octokit.apps.listInstallations();
    
    if (!installations || installations.length === 0) {
      return ["⚠️ لم يتم تثبيت الـ GitHub App على أي مستودع حتى الآن."];
    }

    let allRepos = [];
    for (const installation of installations) {
      const { data: accessTokenData } = await octokit.apps.createInstallationAccessToken({
        installation_id: installation.id,
      });

      const installationOctokit = new Octokit({ auth: accessTokenData.token });
      const { data: reposData } = await installationOctokit.apps.listReposAccessibleToInstallation();

      for (const repo of reposData.repositories) {
        allRepos.push(`[${repo.full_name}](${repo.html_url}) - ${repo.description || "بدون وصف"}`);
      }
    }
    return allRepos;
  } catch (error) {
    console.error("GitHub App API Error:", error);
    return [`خطأ في الاتصال: ${error.message}`];
  }
}

// دالة لجلب محتوى مستودع محدد عبر رابطه وتحليله
async function analyzeRepositoryByUrl(repoUrl) {
  try {
    // استخراج owner و repo من الرابط مثل: https://github.com/Ismail-Benali/HELIOS-NET
    const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(regex);
    if (!match) return "رابط المستودع غير صالح.";

    const owner = match[1];
    const repo = match[2].replace(/\/$/, ""); // إزالة الشرطة المائلة إن وجدت

    const jwtToken = generateGitHubAppJWT();
    const octokit = new Octokit({ auth: jwtToken });
    const { data: installations } = await octokit.apps.listInstallations();

    let repoOctokit = null;
    for (const installation of installations) {
      const { data: accessTokenData } = await octokit.apps.createInstallationAccessToken({
        installation_id: installation.id,
      });
      const tempOctokit = new Octokit({ auth: accessTokenData.token });
      
      // التحقق مما إذا كان هذا التثبيت يمتلك صلاحية على المستودع المطلوب
      try {
        const { data: repoData } = await tempOctokit.repos.get({ owner, repo });
        if (repoData) {
          repoOctokit = tempOctokit;
          break;
        }
      } catch (e) {
        // متابعة البحث في باقي التثبيتات
      }
    }

    if (!repoOctokit) {
      return `عذراً، تطبيق GitHub App غير مثبت على المستودع (${owner}/${repo}) أو ليس لدي صلاحية الوصول إليه. يرجى تثبيت التطبيق عليه أولاً.`;
    }

    // جلب قائمة الملفات الأساسية وهيكل المستودع
    const { data: contents } = await repoOctokit.repos.getContent({ owner, repo, path: "" });
    const fileList = Array.isArray(contents) ? contents.map(f => f.name).join(", ") : "ملف واحد رئيسي";

    // محاولة جلب package.json إن وجد لرؤية التقنيات
    let packageJsonContent = "";
    try {
      const { data: pkgData } = await repoOctokit.repos.getContent({ owner, repo, path: "package.json" });
      packageJsonContent = Buffer.from(pkgData.content, 'base64').toString('utf8');
    } catch (e) {
      packageJsonContent = "لا يوجد ملف package.json";
    }

    return `تم جلب بيانات المستودع (${owner}/${repo}) بنجاح:\n- الملفات والمجلدات الأساسية: ${fileList}\n- محتوى package.json:\n${packageJsonContent}`;
  } catch (error) {
    console.error("Repo Analysis Error:", error);
    return `فشل جلب بيانات المستودع: ${error.message}`;
  }
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
    return res.status(200).json({ status: "HeliosPilot GitHub App is online with Repo Analysis!" });
  }

  try {
    const event = req.headers["x-github-event"];
    const payload = req.body;

    if (event === "issues" && payload.action === "opened") {
      const issueTitle = payload.issue.title;
      const issueBody = payload.issue.body || "لا يوجد وصف";
      const issueUrl = payload.issue.html_url;
      const repoName = payload.repository?.full_name || "مستودع غير معروف";
      const chatId = process.env.TELEGRAM_CHAT_ID;

      const aiReply = await callAIModel(`تحليل Issue جديدة في المستودع ${repoName}:\nالعنوان: ${issueTitle}\nالوصف: ${issueBody}`);
      await sendTelegramMessage(chatId, `🚨 *Issue جديدة في مستودع: ${repoName}!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل HeliosPilot:* \n${aiReply}`);

      return res.status(200).json({ success: true });
    }

    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const userTextLower = userText.toLowerCase();
      const chatId = payload.message.chat.id;

      if (userText === "/start" || userText === "/help") {
        const welcomeText = `👋 أهلاً بك يا H3l!0s_T3k!\n\nأنا **HeliosPilot** (GitHub App). أستطيع تحليل مستودعاتك عبر روابطها مباشرة وتقديم الدعم التقني.`;
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

      // إذا أرسل المستخدم رابط مستودع GitHub
      if (userText.includes("github.com/")) {
        await sendTelegramMessage(chatId, "🔍 جاري فحص المستودع وسحب البيانات عبر GitHub App...");
        const repoDataSummary = await analyzeRepositoryByUrl(userText);
        
        // إرسال البيانات المسحوبة إلى النموذج ليقوم بتحليلها وإعطاء الرأي التقني
        const prompt = `قم بتحليل هذا المستودع بناءً على البيانات المستخرجة:\n${repoDataSummary}`;
        const aiEvaluation = await callAIModel(prompt);

        await sendTelegramMessage(chatId, `📊 *تقييم وتحليل المستودع:*\n\n${aiEvaluation}`);
        return res.status(200).json({ success: true });
      }

      if (
        userTextLower.includes("المستودعات") || 
        userTextLower.includes("المستودع") || 
        userTextLower.includes("repos") ||
        userTextLower.includes("repository") ||
        userTextLower.includes("المستودعات التي انت موجود فيها")
      ) {
        await sendTelegramMessage(chatId, "🔍 جاري فحص المستودعات المثبت عليها تطبيق GitHub App...");
        const repos = await fetchAppInstallationsAndRepos();
        const reposListText = repos.map(r => `• ${r}`).join("\n");

        const responseText = `📂 *المستودعات التي يتواجد فيها تطبيق HeliosPilot:*\n\n${reposListText}`;
        await sendTelegramMessage(chatId, responseText);
        return res.status(200).json({ success: true });
      }

      if (
        userTextLower.includes("من أنت") || 
        userTextLower.includes("من انت") || 
        userTextLower.includes("من صممك") || 
        userTextLower.includes("من انشئك") ||
        userTextLower.includes("من أنشأك") ||
        userTextLower.includes("who are you")
      ) {
        const identityResponse = `أنا **HeliosPilot** صممني (Ismail-Benali) المعروف بـ **H3l!0s_T3k** كـ GitHub App متكامل لتحليل المستودعات ومتابعة الأكواد.`;
        await sendTelegramMessage(chatId, identityResponse);
        return res.status(200).json({ success: true });
      }

      if (userTextLower === "مرحبا" || userTextLower === "سلام" || userTextLower === "hello" || userTextLower === "hi") {
        await sendTelegramMessage(chatId, "أهلاً بك يا H3l!0s_T3k. أنا HeliosPilot، جاهز لمساعدتك في أي مهمة برمجية. ما المطلوب؟");
        return res.status(200).json({ success: true });
      }

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
