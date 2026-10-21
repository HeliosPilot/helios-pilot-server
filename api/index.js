import { kv } from '@vercel/kv';
import { initSentry, captureException } from '../services/sentry.js';
import { sendTelegramMessage, answerTelegramCallback, setTelegramMessageReaction } from '../services/telegram.js';
import { verifyGitHubSignature, addCommentToIssueOrPR, parseAndFetchGitHubUrl, fetchAppInstallationsAndRepos, getInstallationOctokitForRepo } from '../services/github.js';
import { processSmartAIResponse } from '../services/ai.js';

// Initialize Sentry error tracking
initSentry();

const DEFAULT_MEMORY = {
  creator: "Ismail-Benali (H3l!0s_T3k)",
  projectName: "HELIOS-NET & HeliosPilot Ecosystem",
  coreStack: "Node.js, Vercel Serverless, Groq, OpenRouter, GitHub App, Telegram API, Vercel KV, Sentry",
  rules: "أنت خبير مخضرم بخبرة 25 عاماً في هندسة النظم، أمن المعلومات، ASM، و DevSecOps. صُممت لحراسة وتطوير HELIOS-NET.",
  targetProject: "https://github.com/Ismail-Benali/HELIOS-NET",
  dynamicMemory: [],
  userActiveRepos: {}, // { chatId: "owner/repo" }
  admins: [] // list of chatIds
};

// دالة للحصول على ذاكرة الفريق بناءً على الـ ChatID
async function getTeamMemory(chatId) {
  try {
    const mem = await kv.get(`team_memory_${chatId}`);
    return mem ? mem : { ...DEFAULT_MEMORY, dynamicMemory: [], userActiveRepos: {}, admins: [] };
  } catch (err) {
    captureException(err, { context: "getTeamMemory" });
    return { ...DEFAULT_MEMORY, dynamicMemory: [], userActiveRepos: {}, admins: [] };
  }
}

// دالة لحفظ ذاكرة الفريق
async function saveTeamMemory(chatId, mem) {
  try {
    await kv.set(`team_memory_${chatId}`, mem);
  } catch (err) {
    captureException(err, { context: "saveTeamMemory" });
  }
}

export function isAdmin(chatId, memory) {
  return (memory.admins && memory.admins.includes(chatId.toString())) || chatId.toString() === process.env.TELEGRAM_CHAT_ID;
}

// دالة للحصول على الذاكرة العامة (القديمة)
async function getRuntimeMemory() {
  try {
    const mem = await kv.get("helios_runtime_memory");
    return mem ? mem : DEFAULT_MEMORY;
  } catch (err) {
    captureException(err, { context: "getRuntimeMemory" });
    return DEFAULT_MEMORY;
  }
}

async function saveRuntimeMemory(mem) {
  try {
    await kv.set("helios_runtime_memory", mem);
  } catch (err) {
    captureException(err, { context: "saveRuntimeMemory" });
  }
}

// دالة لفتح بطاقة Trello عند فشل العملية
async function createTrelloCard(title, description) {
  const apiKey = process.env.TRELLO_API_KEY;
  const apiToken = process.env.TRELLO_API_TOKEN;
  const listId = process.env.TRELLO_LIST_ID;
  
  if (!apiKey || !apiToken || !listId) return;

  const url = `https://api.trello.com/1/cards?key=${apiKey}&token=${apiToken}&idList=${listId}&name=${encodeURIComponent(title)}&desc=${encodeURIComponent(description)}`;
  await fetch(url, { method: "POST" });
}

// (Duplicate removed)


// (Duplicate removed)


// نظام فهرست ذكي (Vector-like index) للبحث في الكود
async function indexCodebase(owner, repo, files) {
  const index = {};
  for (const path of files) {
    const octokit = await getInstallationOctokitForRepo(owner, repo);
    const { data: file } = await octokit.repos.getContent({ owner, repo, path });
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    
    // استخراج كلمات مفتاحية (بسيطة جداً)
    const keywords = content.toLowerCase().split(/\W+/).filter(w => w.length > 5);
    index[path] = [...new Set(keywords)];
  }
  await kv.set(`code_index_${owner}_${repo}`, index);
}

// بحث سريع في الفهرس
async function searchCodebase(owner, repo, query) {
  const index = await kv.get(`code_index_${owner}_${repo}`) || {};
  const q = query.toLowerCase();
  return Object.keys(index).filter(path => index[path].includes(q));
}

// تجميع التنبيهات في KV بدلاً من الإرسال الفوري
async function queueNotification(chatId, message) {
  const queue = await kv.get(`notification_queue_${chatId}`) || [];
  queue.push({ message, timestamp: Date.now() });
  await kv.set(`notification_queue_${chatId}`, queue);
}

// دالة جديدة لتسليم التنبيهات المجمعة
async function flushNotifications(chatId) {
  const queue = await kv.get(`notification_queue_${chatId}`) || [];
  if (queue.length === 0) return;
  
  const summary = `🔔 **ملخص تنبيهات HeliosPilot (الساعة الماضية):**\n\n` + queue.map(q => `• ${q.message}`).join("\n\n");
  await sendTelegramMessage(chatId, summary);
  await kv.del(`notification_queue_${chatId}`);
}

// دالة تحليل تكلفة CI/CD
async function analyzeCiCost(repo, durationInMs) {
  const costPerHour = 0.008; // سعر تقريبي لدقيقة Actions
  const durationInMin = durationInMs / 60000;
  const cost = durationInMin * costPerHour;
  if (cost > 0.5) { // تنبيه إذا تجاوزت التكلفة 0.5 دولار
    await sendUnifiedNotification(`💸 **تنبيه تكلفة CI/CD:** العملية في ${repo} كلفت ${cost.toFixed(4)}$، وهي أعلى من المعتاد!`);
  }
  return cost;
}

async function saveToErrorKB(errorMessage, solution, repo) {
  const kb = await kv.get("global_error_kb") || {};
  if (!kb[errorMessage]) kb[errorMessage] = [];
  // إضافة الحل وتوثيق المصدر (المستودع)
  kb[errorMessage].push({ solution, repo, timestamp: Date.now() });
  await kv.set("global_error_kb", kb);
}

// (Duplicate removed)


// (Duplicate removed)


async function generateWeeklySummary() {
  try {
    const memory = await getRuntimeMemory();
    const repos = await fetchAppInstallationsAndRepos();
    
    const summary = `📊 *ملخص أسبوعي HELIOS-NET* ⚡\n\n` +
      `- **المالك:** \`${memory.creator}\`\n` +
      `- **المشروع:** ${memory.targetProject}\n` +
      `- **المستودعات المحمية:** ${repos.length > 0 ? repos.length : "لا يوجد"} مستودع\n\n` +
      `_النظام يعمل بكفاءة وحراسة مستمرة مفعّلة._ 🛡️`;
    
    return summary;
  } catch (err) {
    captureException(err, { context: "generateWeeklySummary" });
    return `⚠️ حدث خطأ أثناء توليد التقرير الأسبوعي.`;
  }
}

async function triageAndLabelIssue(owner, repo, issueNumber, issueTitle, issueBody, dynamicMemory) {
  try {
    const prompt = `حلل الـ Issue التالية لمشروع HELIOS-NET واقترح تصنيفاً واحداً أو اثنين من هذه الـ Labels فقط (bug, enhancement, security, documentation, core):\nالعنوان: ${issueTitle}\nالوصف: ${issueBody}\nأجب بكلمات الـ Label مفصولة بمسافة فقط بدون أي نص إضافي.`;
    
    const aiResponse = await processSmartAIResponse(prompt, dynamicMemory);
    const suggestedLabels = aiResponse.toLowerCase().match(/(bug|enhancement|security|documentation|core)/g) || ["bug"];

    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    if (!repoOctokit) return;

    await repoOctokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: suggestedLabels
    });

    await repoOctokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `🤖 **HeliosPilot AI Triage:**\nAnalyzed and categorized under: \`${suggestedLabels.join(', ')}\`. Processing underway.`
    });
  } catch (err) {
    captureException(err, { context: "triageAndLabelIssue" });
  }
}

// دالة RAG الخفيفة لجلب هيكل الكود ومحتوى الملفات الأساسية للإجابة بدقة
async function fetchCodebaseContextForRAG(owner = "Ismail-Benali", repo = "HELIOS-NET") {
  try {
    const octokit = await getInstallationOctokitForRepo(owner, repo);
    if (!octokit) return "Repository access failed: No Octokit instance.";

    // جلب الملفات الأساسية فقط
    const keyFiles = ["api/index.js", "services/ai.js", "services/github.js", "package.json"];
    let context = `Repository Context for HELIOS-NET:\n`;

    try {
      const { data: contents } = await octokit.repos.getContent({ owner, repo, path: "" });
      context += "Root Files: " + (Array.isArray(contents) ? contents.map(f => f.name).join(", ") : "Main entry") + "\n\n";
    } catch (e) { context += "Could not fetch root file structure.\n"; }

    for (const path of keyFiles) {
      try {
        const { data: file } = await octokit.repos.getContent({ owner, repo, path });
        const content = Buffer.from(file.content, 'base64').toString('utf8');
        context += `\n--- File Content: ${path} ---\n${content.substring(0, 3000)}\n`;
      } catch (e) {
        context += `\n--- File: ${path} --- (Error: ${e.message})\n`;
      }
    }

    return context;
  } catch (err) {
    console.error("fetchCodebaseContextForRAG failed:", err);
    return "Repository context fetch failed: " + err.message;
  }
}

// دالة مساعدة للتحقق من أن المستودع هو HELIOS-NET
function isHeliosRepo(owner, repo) {
  return owner.toLowerCase() === "ismail-benali" && repo.toLowerCase() === "helios-net";
}

async function handleTaskFix(chatId, owner, repo, taskType, filePath, memory) {
  if (!isHeliosRepo(owner, repo)) {
    await sendTelegramMessage(chatId, "⛔ هذا المستودع خارج نطاق صلاحياتي.");
    return;
  }
  try {
    await sendTelegramMessage(chatId, `🛠️ **HeliosPilot ${taskType} Engine** جاري العمل...`);
    const fix = await processSmartAIResponse(`Generate a ${taskType} fix for HELIOS-NET on file: ${filePath}. Provide code only, maintain existing style, English comments only.`, memory.dynamicMemory);
    
    const result = await import('../services/github.js').then(m => m.createAutomatedPR(owner, repo, taskType, fix, filePath));
    await sendTelegramMessage(chatId, result);
  } catch (err) {
    captureException(err, { context: "handleTaskFix" });
    await sendTelegramMessage(chatId, `⚠️ **فشل التصحيح التلقائي:** ${err.message}`);
  }
}

export default async function handler(req, res) {
  const envChatId = process.env.TELEGRAM_CHAT_ID;

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.method === "POST") {
    const githubEvent = req.headers?.["x-github-event"];
    if (githubEvent && !verifyGitHubSignature(req)) {
      return res.status(401).json({ error: "Invalid GitHub signature" });
    }

    const telegramSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (telegramSecret) {
      const providedSecret = req.headers?.["x-telegram-bot-api-secret-token"];
      if (providedSecret !== telegramSecret) {
        return res.status(401).json({ error: "Invalid Telegram webhook secret" });
      }
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
  }

  if (req.method === "GET" && req.query.cron === "true") {
    if (envChatId) {
      // تسليم التنبيهات المجمعة أولاً
      await flushNotifications(envChatId);

      const repos = await fetchAppInstallationsAndRepos();
      let alertMsg = "";
      for (const repoFullName of repos) {
        const [owner, repo] = repoFullName.split("/");
        const octokit = await getInstallationOctokitForRepo(owner, repo);
        if (octokit) {
          const { data: alerts } = await octokit.dependabot.listAlertsForRepo({ owner, repo, state: "open" });
          if (alerts.length > 0) {
            alertMsg += `⚠️ *تنبيه في ${repoFullName}:* اكتشاف ${alerts.length} تبعية ضعيفة (Dependabot).\n`;
          }
        }
      }
      
      const digest = `🛡️ **HELIOS-NET Security & Actions Monitoring (HeliosPilot):**\n\n` +
        `• **الحالة:** نشطة ⚡\n` +
        (alertMsg ? `\n${alertMsg}\n` : "✅ لا توجد تنبيهات أمنية جديدة.\n") +
        `_النظام يعمل بأمان._ 🚀`;
      await sendTelegramMessage(envChatId, digest);
    }
    return res.status(200).json({ status: "Security actions briefing dispatched successfully" });
  }

  if (req.method === "GET" && (req.query?.health === "true" || req.url?.includes("health"))) {
    let kvConnected = false;
    try {
      await kv.set("helios_health_ping", Date.now());
      kvConnected = true;
    } catch {
      kvConnected = false;
    }

    return res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        github: Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY),
        ai: Boolean(process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY),
        sentry: Boolean(process.env.SENTRY_DSN),
        kv: kvConnected
      }
    });
  }

  if (req.method !== "POST") {
    return res.status(200).json({
      status: "HeliosPilot Veteran AI DevSecOps Companion is online! ⚡",
      healthCheck: "/api?health=true"
    });
  }

  try {
    const payload = req.body || {};

    // 1. التعامل مع نقرات الأزرار التفاعلية (Callback Query)
    if (payload.callback_query) {
      const callbackQuery = payload.callback_query;
      const queryChatId = callbackQuery.message?.chat?.id?.toString() || envChatId;
      const messageId = callbackQuery.message?.message_id;

      if (envChatId && queryChatId !== envChatId.toString()) {
        await answerTelegramCallback(callbackQuery.id, "⛔ غير مسموح لك باستخدام هذه الأزرار.");
        return res.status(200).json({ success: false });
      }

      await setTelegramMessageReaction(queryChatId, messageId, "🔥");
      const data = callbackQuery.data;
      const memory = await getRuntimeMemory();

      if (data.startsWith("comment:")) {
        const prOrIssueUrl = data.replace("comment:", "");
        await answerTelegramCallback(callbackQuery.id, "⏳ جاري توليد ونشر التعليق التقني بالإنجليزية...");
        const parsedContent = await parseAndFetchGitHubUrl(prOrIssueUrl);
        const commentBody = await processSmartAIResponse(`Write an elite technical comment in English for HELIOS-NET based on:\n${parsedContent}`, memory.dynamicMemory);
        const result = await addCommentToIssueOrPR(prOrIssueUrl, commentBody);
        await sendTelegramMessage(queryChatId, `🤖 *رد أوتوماتيكي عبر HeliosPilot:*\n${result}`);
      } else if (data.startsWith("review:")) {
        const prUrl = data.replace("review:", "");
        await answerTelegramCallback(callbackQuery.id, "🔍 جاري التدقيق الأمني للكود...");
        const parsedContent = await parseAndFetchGitHubUrl(prUrl);
        const reviewBody = await processSmartAIResponse(`Perform an elite 25-yr veteran DevSecOps security & quality code review in English for this PR in HELIOS-NET:\n${parsedContent}`, memory.dynamicMemory);
        const result = await addCommentToIssueOrPR(prUrl, `🛡️ **HeliosPilot Veteran DevSecOps Review:**\n\n${reviewBody}`);
        await sendTelegramMessage(queryChatId, `🛡️ *تم إتمام التدقيق الأمني ونشره على الـ PR بنجاح!* ⚡\n${result}`);
            } else if (data.startsWith("autofix:")) {
        const runUrl = data.replace("autofix:", "");
        await answerTelegramCallback(callbackQuery.id, "🛠️ جاري تحليل فشل الـ CI/CD Actions...");
        await sendTelegramMessage(queryChatId, `🛠️ **HeliosPilot Auto-Patch Engine:**\nتحليل فشل الـ Actions جاري. رابط العملية:\n${runUrl}`);
      } else if (data.startsWith("approve:")) {
        const [_, taskType, filePath, owner, repo] = data.split(":");
        await answerTelegramCallback(callbackQuery.id, "⚡ بدء عملية التصحيح...");
        await sendTelegramMessage(queryChatId, `🤖 **HeliosPilot Engine:**\n1. جاري تحليل الكود والبحث عن الحل الأمثل لـ ${taskType} في \`${filePath}\`...`);
        
        const memory = await getRuntimeMemory();
        
        const fix = await processSmartAIResponse(`Generate a ${taskType} fix for HELIOS-NET on file: ${filePath}. Provide code only, maintain existing style, English comments only.`, memory.dynamicMemory);
        
        await sendTelegramMessage(queryChatId, `2. تم توليد الحل. جاري التواصل مع GitHub لإنشاء فرع (Branch) جديد وفتح Pull Request...`);
        
        const result = await import('../services/github.js').then(m => m.createAutomatedPR(owner, repo, taskType, fix, filePath));
        
        await sendTelegramMessage(queryChatId, `3. تمت المهمة بنجاح! 🎉\n\n${result}`);
      } else if (data.startsWith("mergepr:")) {
        const [_, owner, repo, prNumber] = data.split(":");
        await answerTelegramCallback(callbackQuery.id, "⚡ جاري دمج الـ PR...");
        
        const octokit = await getInstallationOctokitForRepo(owner, repo);
        if (octokit) {
            await octokit.pulls.merge({ owner, repo, pull_number: prNumber });
            await sendTelegramMessage(queryChatId, `✅ **تم دمج الـ PR #${prNumber} بنجاح!** 🎉`);
        }
      } else if (data.startsWith("viewpr:")) {
        const runUrl = data.replace("viewpr:", "");
        await answerTelegramCallback(callbackQuery.id, "🔍 جاري جلب تفاصيل الـ PR...");
        await sendTelegramMessage(queryChatId, `🔗 **رابط العملية المنفذة:**\n${runUrl}`);
      } else if (data.startsWith("patchvuln:")) {
        const vulnInfo = data.replace("patchvuln:", "");
        await answerTelegramCallback(callbackQuery.id, "🛡️ تجهيز الترقيع الأمني...");
        await sendTelegramMessage(queryChatId, `🛡️ **HeliosPilot Security Guardian:**\nجاري معالجة التنبيه الأمني (${vulnInfo}) وتطبيق الـ Security Patch.`);
      } else if (data === "dismiss") {
        await answerTelegramCallback(callbackQuery.id, "✅ تم التجاهل.");
      }

      return res.status(200).json({ success: true });
    }

      // حلقة المراجعة الأمنية التلقائية عند فتح أو تحديث PR
      const ghPayload = payload;
      const event = req.headers?.['x-github-event'] || payload?.event || null;
      if (event === "pull_request" && (ghPayload.action === "opened" || ghPayload.action === "synchronized")) {
        const prNumber = ghPayload.pull_request.number;
        const owner = ghPayload.repository.owner.login;
        const repo = ghPayload.repository.name;
        
        await sendTelegramMessage(envChatId, `🛡️ **HeliosPilot Security Scanner:** جاري فحص الـ PR #${prNumber} بحثاً عن ثغرات...`);
        
        const prFiles = await import('../services/github.js').then(m => m.parseAndFetchGitHubUrl(`${ghPayload.pull_request.html_url}`));
        const reviewResult = await processSmartAIResponse(`Analyze this PR code for OWASP security vulnerabilities. If you find any, explain them and provide a fix. If clean, reply with "SECURE".\n${prFiles}`, []);
        
        if (reviewResult.includes("SECURE")) {
          await sendTelegramMessage(envChatId, `✅ **الـ PR #${prNumber} آمن تماماً.**`);
        } else {
          await sendTelegramMessage(envChatId, `🚨 **ثغرة أمنية مكتشفة في الـ PR #${prNumber}!**\n${reviewResult}`);
          await import('../services/github.js').then(m => postHumanFriendlyComment(owner, repo, prNumber, `🚨 **HeliosPilot Security Alert:**\n${reviewResult}`));
        }
        return res.status(200).json({ success: true });
      }
      if (event === "workflow_run") {
        const workflowName = ghPayload.workflow_run?.name || "Workflow";
        const conclusion = ghPayload.workflow_run?.conclusion;
        const runUrl = ghPayload.workflow_run?.html_url;
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";
        const owner = ghPayload.repository?.owner?.login;
        const repo = ghPayload.repository?.name;

        if (conclusion === "failure") {
          await sendTelegramMessage(targetNotifyChatId, `❌ **فشل في خط البناء Actions (${repoName})!** 🔥\nجاري محاولة التصحيح الذاتي وإنشاء مهمة في Trello...`);
          
          try {
            const parsedPr = await parseAndFetchGitHubUrl(runUrl);
            const autoFix = await processSmartAIResponse(`Generate a precise automated code fix for this CI/CD failure:\n${parsedPr}`, memory.dynamicMemory);

            // إنشاء بطاقة Trello
            await createTrelloCard(`🛠️ Auto-Patch: ${workflowName} Fix`, `Failing Workflow: ${runUrl}\n\nAnalysis:\n${autoFix}`);

            const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
            if (repoOctokit) {
              const pr = await repoOctokit.pulls.create({
                owner,
                repo,
                title: `🛠️ Auto-Patch: ${workflowName} Fix`,
                body: `⚡ **HeliosPilot Self-Healing:** Automatic fix generated for workflow failure.\n\n**Analysis:** ${autoFix}`,
                head: `helios-pilot/self-heal-${Date.now()}`,
                base: "main"
              });
              await sendTelegramMessage(targetNotifyChatId, `✅ **Self-Healing PR تم إنشاؤه بنجاح:** ${pr.data.html_url}`);
            }
          } catch (err) {
            captureException(err, { context: "selfHealing" });
            await sendTelegramMessage(targetNotifyChatId, `⚠️ **فشل التصحيح الذاتي:** ${err.message}`);
          }
        } else if (conclusion === "success" && targetNotifyChatId) {
          await sendTelegramMessage(targetNotifyChatId, `✅ **نجاح خط البناء Actions في ${repoName}!** ⚡\n\n` +
            `• **العملية:** ${workflowName}\n` +
            `• **الحالة:** SUCCESS 🟢\n` +
            `• **الرابط:** ${runUrl}`);
        }
        return res.status(200).json({ success: true });
      }

      if (event === "check_run" && ghPayload.action === "completed") {
        const checkName = ghPayload.check_run?.name || "Check";
        const conclusion = ghPayload.check_run?.conclusion;
        const checkUrl = ghPayload.check_run?.html_url;
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";

        if (conclusion === "failure" && targetNotifyChatId) {
          await sendTelegramMessage(targetNotifyChatId, `❌ **فشل اختبار Check Run في ${repoName}!** 🔥\n\n` +
            `• **الاختبار:** ${checkName}\n` +
            `• **الرابط:** ${checkUrl}`);
        }
        return res.status(200).json({ success: true });
      }

      if (event === "dependabot_alert" || event === "code_scanning_alert" || event === "security_advisory") {
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";
        let alertTitle = "تنبيه أمني جديد";
        let alertDesc = "تم اكتشاف ثغرة أو تبعية ضعيفة.";

        if (event === "dependabot_alert") {
          const pkg = ghPayload.dependabot_alert?.dependency?.package?.name || "مكتبة";
          const sev = ghPayload.dependabot_alert?.security_advisory?.severity || "high";
          alertTitle = `Dependabot Alert: ${pkg} (${sev.toUpperCase()})`;
          alertDesc = ghPayload.dependabot_alert?.security_advisory?.summary || "تحديث أمني مطلوب.";
        } else if (event === "code_scanning_alert") {
          alertTitle = `Code Scanning Alert: ${ghPayload.alert?.rule?.name || "ثغرة برمجية"}`;
          alertDesc = ghPayload.alert?.message?.text || "مشكلة أمنية في الكود.";
        }

        const aiPatch = await processSmartAIResponse(`Provide an elite English security patch recommendation for HELIOS-NET:\nTitle: ${alertTitle}\nDetails: ${alertDesc}`, memory.dynamicMemory);

        if (targetNotifyChatId) {
          await sendTelegramMessage(targetNotifyChatId, `🚨 **تنبيه أمني عاجل لمشروع HELIOS-NET!** ⚡\n\n` +
            `• **النوع:** ${alertTitle}\n` +
            `• **التفاصيل:** ${alertDesc}\n\n` +
            `🤖 **مقترح الترقيح الآلي:**\n${aiPatch}`, {
              inline_keyboard: [
                [
                  { text: "🛡️ تطبيق الترقيع (Patch)", callback_data: `patchvuln:${repoName}` },
                  { text: "✅ تجاهل", callback_data: "dismiss" }
                ]
              ]
            });
        }

        return res.status(200).json({ success: true });
      }

      if (event === "issues" && ghPayload.action === "opened") {
        const issueTitle = ghPayload.issue.title;
        const issueBody = ghPayload.issue.body || "لا يوجد وصف";
        const issueUrl = ghPayload.issue.html_url;
        const owner = ghPayload.repository?.owner?.login;
        const repo = ghPayload.repository?.name;
        const issueNumber = ghPayload.issue.number;

        memory.lastContextUrl = issueUrl;
        await saveRuntimeMemory(memory);

        if (owner && repo) {
          await triageAndLabelIssue(owner, repo, issueNumber, issueTitle, issueBody, memory.dynamicMemory);
        }

        const aiReply = await processSmartAIResponse(`Analyze this new Issue for HELIOS-NET:\nTitle: ${issueTitle}\nBody: ${issueBody}`, memory.dynamicMemory);

        if (targetNotifyChatId) {
          await sendTelegramMessage(targetNotifyChatId, `🚨 *Issue جديدة في HELIOS-NET!* 🧠\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل الحارس المخضرم:* \n${aiReply}`, {
            inline_keyboard: [
              [
                { text: "💬 إضافة تعليق تقني", callback_data: `comment:${issueUrl}` },
                { text: "✅ تجاهل", callback_data: "dismiss" }
              ]
            ]
          });
        }
        return res.status(200).json({ success: true });
      }

      if (event === "pull_request" && (ghPayload.action === "opened" || ghPayload.action === "synchronize")) {
        const prTitle = ghPayload.pull_request.title;
        const prUrl = ghPayload.pull_request.html_url;

        memory.lastContextUrl = prUrl;
        await saveRuntimeMemory(memory);

        const parsedPr = await parseAndFetchGitHubUrl(prUrl);
        const aiReview = await processSmartAIResponse(`Perform an elite 25-yr veteran code review in English for this PR in HELIOS-NET:\n${parsedPr}`, memory.dynamicMemory);
        
        await addCommentToIssueOrPR(prUrl, `🛡️ **HeliosPilot Veteran DevSecOps Review:**\n\n${aiReview}`);

        if (targetNotifyChatId) {
          await sendTelegramMessage(targetNotifyChatId, `🔀 *Pull Request جديد في HELIOS-NET!* 🛡️\n\n📌 *العنوان:* ${prTitle}\n🔗 *الرابط:* ${prUrl}\n\n🤖 *تقرير التدقيق الأمني المخضرم:* \n${aiReview}`, {
            inline_keyboard: [
              [
                { text: "🛡️ نشر مراجعة أمنية جديدة", callback_data: `review:${prUrl}` },
                { text: "💬 إضافة تعليق", callback_data: `comment:${prUrl}` }
              ]
            ]
          });
        }
        return res.status(200).json({ success: true });
      }

    // 3. التعامل مع رسائل المستخدِم المحادثات المباشرة في Telegram
    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const userTextLower = userText.toLowerCase();
      const senderChatId = payload.message.chat?.id?.toString();
      const messageId = payload.message.message_id;

      const targetChatId = senderChatId || envChatId;
      const cleanCmd = userTextLower.split('@')[0].split(' ')[0].trim();

      // أ) الأوامر العامة المتاحة لجميع المستخدمين (/start و /help)
      if (cleanCmd.startsWith("/start") || cleanCmd.startsWith("/help")) {
        const helpText = `👋 أهلاً بك يا خالقي العظيم H3l!0s_T3k! ⚡\n\n` +
          `أنا **HeliosPilot**، الحارس المخضرم (25 عام خبرة) ومساعد **HELIOS-NET** (AI DevSecOps Companion) والمراقب لخطوط الـ Actions و Sentry.\n\n` +
          `• \`/status\` - حالة الحراسة والذاكرة الهندسية\n` +
          `• \`/clear\` - إعادة تهيئة السياق الهندسي\n` +
          `• \`المستودعات\` - عرض المستودعات المحمية\n` +
          `• \`/metrics\` - مقاييس جودة الكود الهندسي\n` +
          `• \`/weekly\` - التقرير الأسبوعي الأمني\n` +
          `• \`/createwiki\` - توليد وتوثيق WIKI.md تلقائياً عبر PR\n` +
          `• \`/autofix\` - فحص وترقيع ثغرات الأمان عبر PR تلقائي\n` +
          `• *(اسألني أي سؤال عن الكود وسأجيبك عبر Codebase RAG!)*`;
        await sendTelegramMessage(targetChatId, helpText);
        return res.status(200).json({ success: true });
      }

      // ب) فحص الصلاحيات للأوامر الحساسة
      if (envChatId && senderChatId && senderChatId !== envChatId.toString()) {
        await sendTelegramMessage(senderChatId, "⛔ **عذراً، أنت لا تملك صلاحية استخدام هذا البوت.**");
        return res.status(200).json({ success: false });
      }

      await setTelegramMessageReaction(targetChatId, messageId, "🧠");
      const memory = await getRuntimeMemory();

      if (!userText.startsWith("/") && userText.length > 15 && (userText.includes("قاعدة") || userText.includes("هندسة") || userText.includes("أمان") || userText.includes("مهم") || userText.includes("helios"))) {
        memory.dynamicMemory.push(userText);
        if (memory.dynamicMemory.length > 25) {
          memory.dynamicMemory.shift();
        }
        await saveRuntimeMemory(memory);
      }

      // ج) الأوامر الفردية المنفصلة بأولوية صارمة
      if (cleanCmd === "/status") {
        const memoryItems = memory.dynamicMemory.length > 0 
          ? memory.dynamicMemory.slice(-5).map((m, i) => `${i + 1}. ${m}`).join("\n") 
          : "لا توجد ملاحظات هندسية مسجلة بعد.";

        await sendTelegramMessage(targetChatId, `⚡ *حالة حارس HELIOS-NET (Actions & Sentry Monitored):* \n\n` +
          `- **المالك:** \`${memory.creator}\`\n` +
          `- **المشروع المحمي:** ${memory.targetProject}\n` +
          `- **آخر رابط في السياق:** ${memory.lastContextUrl || "لا يوجد"}\n` +
          `- **أحدث الملاحظات الهندسية والأمنية:**\n${memoryItems}`);
        return res.status(200).json({ success: true });
      }

      if (cleanCmd === "/clear") {
        memory.lastContextUrl = null;
        await saveRuntimeMemory(memory);
        await sendTelegramMessage(targetChatId, "🧹 تم إعادة تهيئة السياق الهندسي بنجاح. ⚡");
        return res.status(200).json({ success: true });
      }

      if (cleanCmd === "/metrics") {
        await sendTelegramMessage(targetChatId, "🔧 **HeliosPilot Code Metrics**...\n\nجاري تحليل مقاييس الكود مع خبير 25 سنة...");
        const memory = await getRuntimeMemory();
        const metrics = await processSmartAIResponse(`Analyze code metrics for HELIOS-NET: complexity, maintainability, and suggest improvements. Provide technical English comments only.`, memory.dynamicMemory);
        await sendTelegramMessage(targetChatId, `📊 *مقاييس HELIOS-NET المخضرم:*\n\n${metrics}`, {
          inline_keyboard: [[{ text: "🔄 تحليل مرة أخرى", callback_data: `comment:${memory.targetProject}` }]]
        });
        return res.status(200).json({ success: true });
      }

      if (cleanCmd.startsWith("/analyze-perf")) {
        const activeRepo = memory.userActiveRepos[targetChatId] || "Ismail-Benali/HELIOS-NET";
        await sendTelegramMessage(targetChatId, `🚀 *HeliosPilot Performance Analyzer:* جارٍ تحليل الكود في \`${activeRepo}\`...`);
        
        const [owner, repo] = activeRepo.split("/");
        const context = await fetchCodebaseContextForRAG(owner, repo);
        const analysis = await processSmartAIResponse(`Analyze this codebase for performance bottlenecks, time complexity, and inefficient operations. Provide concise optimization suggestions:\n${context}`, memory.dynamicMemory);
        
        await sendTelegramMessage(targetChatId, `⚡ *HeliosPilot Analysis:*\n\n${analysis}`);
        return res.status(200).json({ success: true });
      }

      if (cleanCmd.startsWith("/review ")) {
        const prUrl = cleanCmd.replace("/review ", "").trim();
        await sendTelegramMessage(targetChatId, "🛡️ **HeliosPilot Security Audit:** جاري فحص الـ PR...");
        
        const prContent = await parseAndFetchGitHubUrl(prUrl);
        const review = await processSmartAIResponse(`Perform an elite 25-yr veteran DevSecOps security & quality code review for this PR:\n${prContent}`, memory.dynamicMemory);
        
        await sendTelegramMessage(targetChatId, `🛡️ *تقرير التدقيق الأمني:*\n\n${review}`);
        return res.status(200).json({ success: true });
      }

      if (cleanCmd === "/createwiki") {
        await sendTelegramMessage(targetChatId, "📝 **HeliosPilot Wiki Engine** جاري العمل...");
        const memory = await getRuntimeMemory();
        const activeRepo = memory.userActiveRepos[targetChatId] || "Ismail-Benali/HELIOS-NET";
        const [owner, repo] = activeRepo.split("/");
        
        const codebaseContext = await fetchCodebaseContextForRAG(owner, repo);
        const wikiContent = await processSmartAIResponse(`Generate a comprehensive WIKI.md page for ${activeRepo} based on:\n${codebaseContext}`, memory.dynamicMemory);
        
        const result = await import('../services/github.js').then(m => m.createFileInRepo(owner, repo, "WIKI.md", wikiContent, "📝 Create WIKI.md automatically"));
        await sendTelegramMessage(targetChatId, result);
        return res.status(200).json({ success: true });
      }

      if (cleanCmd === "/autofix") {
        await sendTelegramMessage(targetChatId, "🛠️ **HeliosPilot Auto-Patch Engine** بدء التشغيل...");
        const memory = await getRuntimeMemory();
        const activeRepo = memory.userActiveRepos[targetChatId] || "Ismail-Benali/HELIOS-NET";
        const [owner, repo] = activeRepo.split("/");
        
        try {
          const repoOctokit = await import('../services/github.js').then(m => m.getInstallationOctokitForRepo(owner, repo));
          if (repoOctokit) {
              const { data: alerts } = await repoOctokit.codeScanning.listAlertsForRepo({ owner, repo, state: "open" });
              if (alerts.length > 0) {
                  const alert = alerts[0];
                  const fix = await processSmartAIResponse(`Generate a security fix for: ${alert.rule.description}. Provide code only.`, memory.dynamicMemory);
                  const result = await import('../services/github.js').then(m => m.createAutomatedPR(owner, repo, "security-fix", fix, alert.most_recent_instance.location.path));
                  await sendTelegramMessage(targetChatId, result);
              } else {
                  await sendTelegramMessage(targetChatId, "✅ لا توجد ثغرات مفتوحة في المستودع المحدد!");
              }
          }
        } catch (e) {
          await sendTelegramMessage(targetChatId, "⚠️ تعذر الوصول لـ GitHub Code Scanning. تأكد من تفعيل الأمان في المستودع.");
          captureException(e, { context: "autofix" });
        }
        return res.status(200).json({ success: true });
      }

      if (cleanCmd === "المستودعات" || cleanCmd === "repos" || cleanCmd === "repository" || userTextLower.includes("المستودعات") || userTextLower.includes("repos")) {
        await sendTelegramMessage(targetChatId, "🔍 جاري فحص المستودعات المحمية...");
        const repos = await fetchAppInstallationsAndRepos();
        await sendTelegramMessage(targetChatId, `📂 *المستودعات المحمية (HELIOS-NET Ecosystem):*\n\n${repos.map(r => `• ${r}`).join("\n")}`);
        return res.status(200).json({ success: true });
      }

      if (userTextLower.includes("اضف تعليق") || userTextLower.includes("اكتب تعليق") || userTextLower.includes("تعليق")) {
        const urlMatch = userText.match(/https?:\/\/(www\.)?github\.com\/[^\s]+/);
        let targetUrl = urlMatch ? urlMatch[0] : memory.lastContextUrl;

        if (!targetUrl) {
          await sendTelegramMessage(targetChatId, "⚠️ لم أجد رابط Issue أو PR في الرسالة أو السياق السابق.");
          return res.status(200).json({ success: true });
        }

        let commentText = userText.replace(targetUrl, "").replace(/اضف تعليق|اكتب تعليق|على|لـ/g, "").trim();

        if (!commentText || commentText.length < 3) {
          await sendTelegramMessage(targetChatId, `🔍 جاري تحليل الـ Issue/PR وصياغة التعليق التقني بالإنجليزية...`);
          const issueContent = await parseAndFetchGitHubUrl(targetUrl);
          commentText = await processSmartAIResponse(`Write an elite technical comment in English for HELIOS-NET based on:\n${issueContent}`, memory.dynamicMemory);
        } else {
          await sendTelegramMessage(targetChatId, "⏳ جاري النشر على GitHub...");
        }

        const resultResponse = await addCommentToIssueOrPR(targetUrl, commentText);
        await sendTelegramMessage(targetChatId, resultResponse);
        return res.status(200).json({ success: true });
      }

      if (userText.includes("github.com/")) {
        const urlMatch = userText.match(/https?:\/\/(www\.)?github\.com\/[^\s]+/);
        if (!urlMatch) {
          return res.status(200).json({ success: true });
        }
        memory.lastContextUrl = urlMatch[0];
        await saveRuntimeMemory(memory);

        await sendTelegramMessage(targetChatId, "🔍 جاري تحليل المستودع والتدقيق الأمني... 🛡️");
        const extractedData = await parseAndFetchGitHubUrl(userText);
        const aiEvaluation = await processSmartAIResponse(`Analyze this repository data for HELIOS-NET with 25-yr veteran precision:\n${extractedData}`, memory.dynamicMemory);

        await sendTelegramMessage(targetChatId, `📊 *تحليل HELIOS-NET المخضرم:*\n\n${aiEvaluation}`, {
          inline_keyboard: [
            [
              { text: "💬 إضافة تعليق تقني", callback_data: `comment:${urlMatch ? urlMatch[0] : memory.lastContextUrl}` },
              { text: "🛡️ تدقيق أمني للـ PR", callback_data: `review:${urlMatch ? urlMatch[0] : memory.lastContextUrl}` }
            ]
          ]
        });
        return res.status(200).json({ success: true });
      }

      // د) Codebase RAG: الرد الذكي مع جلب سياق الكود الحقيقي للمستودع عند طرح أي سؤال عام
      try {
        await sendTelegramMessage(targetChatId, "🧠 جاري البحث في بنية الكود والمستودع...");
        const codebaseContext = await fetchCodebaseContextForRAG();
        const promptWithContext = `User Question: ${userText}\n\nReal Codebase Context from HELIOS-NET:\n${codebaseContext}`;
        
        const replyText = await processSmartAIResponse(promptWithContext, memory.dynamicMemory);
        await sendTelegramMessage(targetChatId, replyText ?? "🤖 HeliosPilot: تم استقبال رسالتك ولكناجهز رداً تقنياً...");
      } catch (aiError) {
        captureException(aiError, { context: "codebaseRAG" });
        await sendTelegramMessage(targetChatId, "🤖 HeliosPilot: استقبلتُ رسالتك ولكن واجهت صعوبة في المعالجة التقنية حالياً. حاول مرة أخرى لاحقاً. ⚡");
      }

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Handler Error:", error);
    captureException(error, { context: "main_handler" });
    return res.status(500).json({ error: "Internal server error" });
  }
}
