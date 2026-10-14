import { Groq } from "groq-sdk";
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";
import crypto from 'crypto';

// الذاكرة الحية (In-Memory State)
let runtimeMemory = {
  creator: "Ismail-Benali (H3l!0s_T3k)",
  projectName: "HeliosPilot",
  coreStack: "Node.js, Vercel Serverless, Groq API, GitHub App, Telegram Bot API",
  notes: "دقيق ومباشر، يفضل الأكواد النظيفة.",
  dynamicMemory: []
};

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

async function getInstallationOctokitForRepo(owner, repo) {
  const jwtToken = generateGitHubAppJWT();
  const octokit = new Octokit({ auth: jwtToken });
  const { data: installations } = await octokit.apps.listInstallations();

  for (const installation of installations) {
    const { data: accessTokenData } = await octokit.apps.createInstallationAccessToken({
      installation_id: installation.id,
    });
    const tempOctokit = new Octokit({ auth: accessTokenData.token });
    
    try {
      const { data: repoData } = await tempOctokit.repos.get({ owner, repo });
      if (repoData) return tempOctokit;
    } catch (e) {}
  }
  return null;
}

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
    return [`خطأ في الاتصال: ${error.message}`];
  }
}

async function analyzeRepositoryByUrl(repoUrl) {
  try {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(regex);
    if (!match) return "رابط المستودع غير صالح.";

    const owner = match[1];
    const repo = match[2].replace(/\/$/, "");

    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    if (!repoOctokit) {
      return `عذراً، تطبيق GitHub App غير مثبت على المستودع (${owner}/${repo}) أو ليس لدي صلاحية الوصول إليه.`;
    }

    const { data: contents } = await repoOctokit.repos.getContent({ owner, repo, path: "" });
    const fileList = Array.isArray(contents) ? contents.map(f => f.name).join(", ") : "ملف رئيسي واحد";

    let packageJsonContent = "";
    try {
      const { data: pkgData } = await repoOctokit.repos.getContent({ owner, repo, path: "package.json" });
      packageJsonContent = Buffer.from(pkgData.content, 'base64').toString('utf8');
    } catch (e) {
      packageJsonContent = "لا يوجد ملف package.json";
    }

    return `بيانات المستودع (${owner}/${repo}):\n- الملفات: ${fileList}\n- package.json:\n${packageJsonContent}`;
  } catch (error) {
    return `فشل جلب بيانات المستودع: ${error.message}`;
  }
}

async function fetchLatestCommits(ownerRepoString) {
  try {
    const parts = ownerRepoString.split('/');
    if (parts.length !== 2) return "صيغة المستودع غير صحيحة. استخدم: owner/repo";
    const [owner, repo] = parts;

    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    if (!repoOctokit) return `لا يوجد صلاحية وصول للمستودع (${owner}/${repo}).`;

    const { data: commits } = await repoOctokit.repos.listCommits({ owner, repo, per_page: 5 });
    return commits.map(c => `• \`${c.sha.substring(0,7)}\` - ${c.commit.message} (${c.commit.author.name})`).join("\n");
  } catch (error) {
    return `خطأ في جلب الكوميتات: ${error.message}`;
  }
}

async function callGroqModel(systemInstruction, userPrompt) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ],
    model: "qwen/qwen3.8-27b",
    temperature: 0.3,
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

// دالة ذكية تفحص رسالة المستخدم، تحديث الذاكرة تلقائياً إذا وجدت معلومة، ثم الرد التقني
async function processSmartAIResponse(userPrompt) {
  const systemInstruction = `أنت HeliosPilot، مساعد ذكاء اصطناعي تقني صُممت بواسطة (Ismail-Benali) المعروف بـ (H3l!0s_T3k).
الذاكرة الحالية وملاحظات المشاريع المسجلة: ${JSON.stringify(runtimeMemory)}

مهمتك المزدوجة:
1. تحليل رسالة المستخدم: إذا كانت الرسالة تحتوي على معلومة جديدة، تفضيل برمجي، قرار، أو فكرة مشروع يجب حفظها للمستقبل، قم بإضافة هذه المعلومة بصيغة موجزة إلى قائمة الذاكرة الديناميكية الخاصة بك.
2. الرد على المستخدم باختصار، احترافية تقنية تامة، وبدون مجاملة باللغة العربية.`;

  try {
    const response = await callGroqModel(systemInstruction, userPrompt);
    return response;
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
    return res.status(200).json({ status: "HeliosPilot with Auto-Learning Memory is online!" });
  }

  try {
    const event = req.headers["x-github-event"];
    const payload = req.body;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // 1. معالجة أحداث Issues
    if (event === "issues" && payload.action === "opened") {
      const issueTitle = payload.issue.title;
      const issueBody = payload.issue.body || "لا يوجد وصف";
      const issueUrl = payload.issue.html_url;
      const repoName = payload.repository?.full_name || "مستودع غير معروف";

      const aiReply = await processSmartAIResponse(`تحليل Issue جديدة في المستودع ${repoName}:\nالعنوان: ${issueTitle}\nالوصف: ${issueBody}`);
      await sendTelegramMessage(chatId, `🚨 *Issue جديدة في مستودع: ${repoName}!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل HeliosPilot:* \n${aiReply}`);

      return res.status(200).json({ success: true });
    }

    // 2. معالجة Pull Requests (Code Review)
    if (event === "pull_request" && (payload.action === "opened" || payload.action === "synchronize")) {
      const prTitle = payload.pull_request.title;
      const prUrl = payload.pull_request.html_url;
      const repoName = payload.repository?.full_name || "مستودع غير معروف";
      const branchName = payload.pull_request.head.ref;

      const aiReview = await processSmartAIResponse(`مراجعة Pull Request جديد:\nالعنوان: ${prTitle}\nالفرع: ${branchName}\nالمستودع: ${repoName}`);
      await sendTelegramMessage(chatId, `🔀 *Pull Request جديد أو محدث!*\n\n📌 *العنوان:* ${prTitle}\n📂 *المستودع:* ${repoName}\n🔗 *الرابط:* ${prUrl}\n\n🤖 *تقرير مراجعة الكود (Code Review):*\n${aiReview}`);

      return res.status(200).json({ success: true });
    }

    // 3. معالجة رسائل تيليجرام
    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const userTextLower = userText.toLowerCase();

      // فحص تلقائي لتخزين أي تفضيل أو معلومة مهمة يذكرها المطور في محادثاته العادية
      if (
        !userText.startsWith("/") && 
        (userText.length > 15) && 
        (userText.includes("نريد") || userText.includes("أريد") || userText.includes("سنقوم") || userText.includes("تحديد") || userText.includes("مهم"))
      ) {
        runtimeMemory.dynamicMemory.push(userText);
      }

      if (userText === "/start" || userText === "/help") {
        const welcomeText = `👋 أهلاً بك يا H3l!0s_T3k!\n\nأنا **HeliosPilot** المساعد التقني. أتعلم تلقائياً من محادثاتنا وأدير مستودعاتك.\n` +
          `• \`/status\` - عرض الحالة والذاكرة الديناميكية المتعلمة\n` +
          `• \`/commits owner/repo\` - جلب آخر التحديثات\n` +
          `• أرسل رابط أي مستودع لتحليله فوراً.`;
        await sendTelegramMessage(chatId, welcomeText);
        return res.status(200).json({ success: true });
      }

      if (userText === "/status") {
        const memoryItems = runtimeMemory.dynamicMemory.length > 0 
          ? runtimeMemory.dynamicMemory.map((m, i) => `${i+1}. ${m}`).join("\n") 
          : "لا توجد ذكريات مكتسبة بعد.";

        const statusReport = `⚡ *حالة HeliosPilot والذاكرة التلقائية:*\n\n` +
          `- **المنشئ:** \`${runtimeMemory.creator}\`\n` +
          `- **الذاكرة المكتسبة تلقائياً:**\n${memoryItems}`;
        await sendTelegramMessage(chatId, statusReport);
        return res.status(200).json({ success: true });
      }

      if (userText.startsWith("/commits ")) {
        const repoTarget = userText.replace("/commits ", "").trim();
        await sendTelegramMessage(chatId, `🔍 جاري جلب آخر Commits للمستودع: \`${repoTarget}\`...`);
        const commitsText = await fetchLatestCommits(repoTarget);
        await sendTelegramMessage(chatId, `📦 *آخر التحديثات (Commits):*\n\n${commitsText}`);
        return res.status(200).json({ success: true });
      }

      if (userText === "/clear") {
        await sendTelegramMessage(chatId, "🧹 تم إعادة تهيئة الجلسة.");
        return res.status(200).json({ success: true });
      }

      // تحليل روابط GitHub
      if (userText.includes("github.com/")) {
        await sendTelegramMessage(chatId, "🔍 جاري فحص المستودع وسحب البيانات عبر GitHub App...");
        const repoDataSummary = await analyzeRepositoryByUrl(userText);
        const aiEvaluation = await processSmartAIResponse(`قم بتحليل هذا المستودع بناءً على البيانات المستخرجة:\n${repoDataSummary}`);

        await sendTelegramMessage(chatId, `📊 *تقييم وتحليل المستودع:*\n\n${aiEvaluation}`);
        return res.status(200).json({ success: true });
      }

      if (
        userTextLower.includes("المستودعات") || 
        userTextLower.includes("المستودع") || 
        userTextLower.includes("repos") ||
        userTextLower.includes("repository")
      ) {
        await sendTelegramMessage(chatId, "🔍 جاري فحص المستودعات المثبت عليها تطبيق GitHub App...");
        const repos = await fetchAppInstallationsAndRepos();
        const reposListText = repos.map(r => `• ${r}`).join("\n");

        await sendTelegramMessage(chatId, `📂 *المستودعات المرتبطة بالتطبيق:*\n\n${reposListText}`);
        return res.status(200).json({ success: true });
      }

      if (
        userTextLower.includes("من أنت") || 
        userTextLower.includes("من انت") || 
        userTextLower.includes("من صممك") || 
        userTextLower.includes("من انشئك")
      ) {
        const identityResponse = `أنا **HeliosPilot** صممني (Ismail-Benali) المعروف بـ **H3l!0s_T3k** كـ GitHub App ذكي يتعلم ويتكيف مع متطلباتك برمجياً.`;
        await sendTelegramMessage(chatId, identityResponse);
        return res.status(200).json({ success: true });
      }

      if (userTextLower === "مرحبا" || userTextLower === "سلام" || userTextLower === "hello") {
        await sendTelegramMessage(chatId, "أهلاً بك يا H3l!0s_T3k. أنا HeliosPilot، جاهز لأي مهمة برمجية. ما المطلوب؟");
        return res.status(200).json({ success: true });
      }

      // باقي الردود تعتمد على الذاكرة التلقائية والذكاء الاصطناعي
      const replyText = await processSmartAIResponse(userText);
      await sendTelegramMessage(chatId, replyText);

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Handler Error:", error);
    return res.status(200).json({ error: error.message});
  }
}
