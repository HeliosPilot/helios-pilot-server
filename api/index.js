import { Groq } from "groq-sdk";
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";
import crypto from 'crypto';

// الذاكرة الحية مع إدارة سياق المحادثات والتفضيلات
let runtimeMemory = {
  creator: "Ismail-Benali (H3l!0s_T3k)",
  projectName: "HeliosPilot Pro Enterprise",
  coreStack: "Node.js, Vercel Serverless, Groq, OpenRouter, GitHub App, Telegram API",
  rules: "دقيق، مباشر، تقني بحت، بدون مجاملة، التركيز المطلق على الأداء والوعي بالصلاحيات.",
  lastContextUrl: null, // تتبع آخر رابط تم مناقشته في الشات
  dynamicMemory: []
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  const MAX_LENGTH = 4000;
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    const chunk = text.substring(i, i + MAX_LENGTH);
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }),
      });
    } catch (err) {
      console.error("Telegram Send Error:", err);
    }
  }
}

function verifyGitHubSignature(req) {
  const signature = req.headers["x-hub-signature-256"];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!signature || !secret) return true;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
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
  try {
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
  } catch (error) {
    console.error("Error finding installation Octokit:", error);
  }
  return null;
}

// إضافة تعليق على Issue مع التحقق التلقائي من صلاحيات الكتابة
async function addCommentToIssue(url, commentBody) {
  try {
    const issueMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
    if (!issueMatch) return "⚠️ رابط الـ Issue غير صالح لإضافة التعليق.";

    const [, owner, repo, issueNumber] = issueMatch;
    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    
    if (!repoOctokit) {
      return `🛑 **صلاحيات مفقودة:** المستودع \`${owner}/${repo}\` غير مقترن بـ GitHub App أو لا أملك صلاحية الكتابة عليه. يرجى التثبيت أو منح الصلاحيات من إعدادات الـ App.`;
    }

    await repoOctokit.issues.createComment({
      owner,
      repo,
      issue_number: parseInt(issueNumber),
      body: commentBody
    });

    return `✅ **تم النشر:** تم إضافة التعليق بنجاح على الـ Issue #${issueNumber} في (\`${owner}/${repo}\`).`;
  } catch (error) {
    return `❌ **فشل النشر:** ${error.message}`;
  }
}

// قراءة وتحليل بيانات غيت هب
async function parseAndFetchGitHubUrl(url) {
  try {
    const issueMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
    if (issueMatch) {
      const [, owner, repo, issueNumber] = issueMatch;
      const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
      if (!repoOctokit) {
        return `🛑 المستودع \`${owner}/${repo}\` غير مرتبط بـ GitHub App. لا يمكن القراءة منه.`;
      }

      const { data: issue } = await repoOctokit.issues.get({ owner, repo, issue_number: parseInt(issueNumber) });
      const { data: comments } = await repoOctokit.issues.listComments({ owner, repo, issue_number: parseInt(issueNumber) });

      const commentsText = comments.length > 0 
        ? comments.map(c => `- @${c.user.login}: ${c.body}`).join("\n") 
        : "لا توجد تعليقات.";

      return `📌 **Issue #${issueNumber} في (${owner}/${repo}):**\n` +
        `- **العنوان:** ${issue.title}\n` +
        `- **الحالة:** ${issue.state}\n` +
        `- **المنشئ:** @${issue.user.login}\n` +
        `- **الوصف:**\n${issue.body || "لا يوجد وصف."}\n\n` +
        `💬 **التعليقات (${comments.length}):**\n${commentsText}`;
    }

    const prMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (prMatch) {
      const [, owner, repo, prNumber] = prMatch;
      const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
      if (!repoOctokit) return `🛑 المستودع \`${owner}/${repo}\` غير مرتبط بـ GitHub App.`;

      const { data: pr } = await repoOctokit.pulls.get({ owner, repo, pull_number: parseInt(prNumber) });
      const { data: files } = await repoOctokit.pulls.listFiles({ owner, repo, pull_number: parseInt(prNumber) });
      const filesSummary = files.map(f => `- \`${f.filename}\` (${f.status}: +${f.additions}, -${f.deletions})`).join("\n");

      return `🔀 **Pull Request #${prNumber} في (${owner}/${repo}):**\n` +
        `- **العنوان:** ${pr.title}\n` +
        `- **الحالة:** ${pr.state}\n` +
        `- **الفروع:** ${pr.head.ref} ⬅️ ${pr.base.ref}\n` +
        `- **الوصف:**\n${pr.body || "لا يوجد وصف."}\n\n` +
        `📂 **الملفات المعدلة (${files.length}):**\n${filesSummary}`;
    }

    const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (repoMatch) {
      const owner = repoMatch[1];
      const repo = repoMatch[2].replace(/\/$/, "");

      const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
      if (!repoOctokit) return `🛑 المستودع \`${owner}/${repo}\` غير مرتبط بـ GitHub App.`;

      const { data: contents } = await repoOctokit.repos.getContent({ owner, repo, path: "" });
      const fileList = Array.isArray(contents) ? contents.map(f => f.name).join(", ") : "ملف رئيسي واحد";

      return `📂 **بيانات المستودع (${owner}/${repo}):**\n- الملفات: ${fileList}`;
    }

    return "رابط GitHub غير صالح أو غير مدعوم.";
  } catch (error) {
    return `خطأ أثناء قراءة البيانات من GitHub: ${error.message}`;
  }
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

async function processSmartAIResponse(userPrompt) {
  const systemInstruction = `أنت HeliosPilot Pro، مساعد ذكاء اصطناعي تقني صُممت بواسطة (Ismail-Benali) المعروف بـ (H3l!0s_T3k).
الذاكرة الحية ومفهوم السياق الحالي: ${JSON.stringify(runtimeMemory)}

قواعد الرد الذكي:
1. كن واعياً بالصلاحيات: إذا طُلِب إجراء تغيير أو تعليق على مستودع غير مرتبط، وضح الصلاحيات المطلوبة.
2. أجب باختصار، بدقة تقنية تامة، وباللغة العربية، وبدون أي مجاملة.`;

  try {
    return await callGroqModel(systemInstruction, userPrompt);
  } catch (groqError) {
    try {
      return await callOpenRouterModel(systemInstruction, userPrompt);
    } catch (openRouterError) {
      return `عذراً، حدث خطأ في خدمات الذكاء الاصطناعي المتاحة.`;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ status: "HeliosPilot Smart Context Engine is online!" });
  }

  try {
    if (!verifyGitHubSignature(req)) {
      return res.status(401).json({ error: "Invalid GitHub Webhook Signature" });
    }

    const event = req.headers["x-github-event"];
    const payload = req.body;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // 1. معالجة الأحداث القادمة من GitHub
    if (event === "issues" && payload.action === "opened") {
      const issueTitle = payload.issue.title;
      const issueBody = payload.issue.body || "لا يوجد وصف";
      const issueUrl = payload.issue.html_url;
      const repoName = payload.repository?.full_name || "مستودع غير معروف";

      runtimeMemory.lastContextUrl = issueUrl; // حفظ الرابط في السياق

      const aiReply = await processSmartAIResponse(`تحليل Issue جديدة في ${repoName}:\nالعنوان: ${issueTitle}\nالوصف: ${issueBody}`);
      await sendTelegramMessage(chatId, `🚨 *Issue جديدة في مستودع: ${repoName}!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل HeliosPilot:* \n${aiReply}`);

      return res.status(200).json({ success: true });
    }

    if (event === "pull_request" && (payload.action === "opened" || payload.action === "synchronize")) {
      const prTitle = payload.pull_request.title;
      const prUrl = payload.pull_request.html_url;
      const repoName = payload.repository?.full_name || "مستودع غير معروف";

      runtimeMemory.lastContextUrl = prUrl;

      const aiReview = await processSmartAIResponse(`مراجعة Pull Request جديد:\nالعنوان: ${prTitle}\nالمستودع: ${repoName}`);
      await sendTelegramMessage(chatId, `🔀 *Pull Request جديد أو محدث!*\n\n📌 *العنوان:* ${prTitle}\n📂 *المستودع:* ${repoName}\n🔗 *الرابط:* ${prUrl}\n\n🤖 *تقرير مراجعة الكود:*\n${aiReview}`);

      return res.status(200).json({ success: true });
    }

    // 2. معالجة الرسائل القادمة من تيليجرام
    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const userTextLower = userText.toLowerCase();

      // تخزين التفضيلات التلقائية
      if (!userText.startsWith("/") && userText.length > 15 && (userText.includes("نريد") || userText.includes("أريد") || userText.includes("مهم") || userText.includes("قاعدة"))) {
        runtimeMemory.dynamicMemory.push(userText);
      }

      if (userText === "/start" || userText === "/help") {
        await sendTelegramMessage(chatId, `👋 أهلاً بك يا H3l!0s_T3k!\n\nأنا **HeliosPilot Pro**. أدير السياق والتعليقات والصلاحيات لجميع مستودعاتك.\n` +
          `• \`/status\` - عرض الحالة والذاكرة والمستودع الحالي في السياق\n` +
          `• اكتب "اضف تعليق" لمتابعة العمل على آخر Issue تم التطرق إليها.`);
        return res.status(200).json({ success: true });
      }

      if (userText === "/status") {
        const memoryItems = runtimeMemory.dynamicMemory.length > 0 
          ? runtimeMemory.dynamicMemory.map((m, i) => `${i+1}. ${m}`).join("\n") 
          : "لا توجد ذكريات مكتسبة بعد.";

        await sendTelegramMessage(chatId, `⚡ *حالة HeliosPilot Pro:*\n\n` +
          `- **المنشئ:** \`${runtimeMemory.creator}\`\n` +
          `- **آخر رابط في السياق:** ${runtimeMemory.lastContextUrl || "لا يوجد"}\n` +
          `- **الذاكرة المكتسبة:**\n${memoryItems}`);
        return res.status(200).json({ success: true });
      }

      if (userText === "/clear") {
        runtimeMemory.lastContextUrl = null;
        await sendTelegramMessage(chatId, "🧹 تم إعادة تهيئة السياق والجلسة.");
        return res.status(200).json({ success: true });
      }

      // معالجة طلبات إضافة التعليق مع الاستفادة من سياق المحادثة المباشر
      if (userTextLower.includes("اضف تعليق") || userTextLower.includes("اكتب تعليق") || userTextLower.includes("تعليق")) {
        const urlMatch = userText.match(/https:\/\/github\.com\/[^\s]+/);
        let targetUrl = urlMatch ? urlMatch[0] : runtimeMemory.lastContextUrl;

        if (!targetUrl) {
          await sendTelegramMessage(chatId, "⚠️ لم أجد رابط Issue في الرسالة أو في سياق المحادثة السابق. يرجى تزويدي بالرابط.");
          return res.status(200).json({ success: true });
        }

        let commentText = userText.replace(targetUrl, "").replace(/اضف تعليق|اكتب تعليق|على|لـ/g, "").trim();

        if (!commentText || commentText.length < 3) {
          await sendTelegramMessage(chatId, `🔍 جاري تحليل الـ Issue وسياقها لصياغة ونشر التعليق التقني...`);
          const issueContent = await parseAndFetchGitHubUrl(targetUrl);
          commentText = await processSmartAIResponse(`بناءً على تفاصيل الـ Issue التالية، اكتب تعليقاً تقنياً احترافياً ومباشراً لنشره:\n${issueContent}`);
        } else {
          await sendTelegramMessage(chatId, "⏳ جاري فحص الصلاحيات ونشر التعليق على GitHub...");
        }

        const resultResponse = await addCommentToIssue(targetUrl, commentText);
        await sendTelegramMessage(chatId, resultResponse);
        return res.status(200).json({ success: true });
      }

      // معالجة روابط GitHub العامة وحفظها في السياق
      if (userText.includes("github.com/")) {
        const urlMatch = userText.match(/https:\/\/github\.com\/[^\s]+/);
        if (urlMatch) {
          runtimeMemory.lastContextUrl = urlMatch[0]; // حفظ الرابط في السياق
        }

        await sendTelegramMessage(chatId, "🔍 جاري سحب وتحليل البيانات عبر GitHub App API...");
        const extractedData = await parseAndFetchGitHubUrl(userText);
        const aiEvaluation = await processSmartAIResponse(`أجب بناءً على البيانات المستخرجة بدقة متناهية:\n${extractedData}`);

        await sendTelegramMessage(chatId, `📊 *تحليل HeliosPilot الشامل:*\n\n${aiEvaluation}`);
        return res.status(200).json({ success: true });
      }

      if (userTextLower.includes("المستودعات") || userTextLower.includes("repos") || userTextLower.includes("repository")) {
        await sendTelegramMessage(chatId, "🔍 جاري فحص المستودعات المرتبطة بالتطبيق...");
        const repos = await fetchAppInstallationsAndRepos();
        await sendTelegramMessage(chatId, `📂 *المستودعات المثبت عليها التطبيق:*\n\n${repos.map(r => `• ${r}`).join("\n")}`);
        return res.status(200).json({ success: true });
      }

      const replyText = await processSmartAIResponse(userText);
      await sendTelegramMessage(chatId, replyText);

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Handler Error:", error);
    return res.status(200).json({ error: error.message });
  }
}
