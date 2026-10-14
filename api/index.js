import { Groq } from "groq-sdk";
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";
import crypto from 'crypto';
import { kv } from '@vercel/kv';

const DEFAULT_MEMORY = {
  creator: "Ismail-Benali (H3l!0s_T3k)",
  projectName: "HELIOS-NET & HeliosPilot Ecosystem",
  coreStack: "Node.js, Vercel Serverless, Groq, OpenRouter, GitHub App, Telegram API, Vercel KV",
  rules: "أنت الحارس والمساعد التقني الأمني المخصص لمشروع HELIOS-NET. تخصصك الأساسي هو AI DevSecOps & ASM Companion. لا تقم بتخزين المواضيع العابرة أو الجانبية (كالفلسفة وغيرها) في الذاكرة المستدامة؛ احصر الذاكرة في الملاحظات التقنية، هندسة الأكواد، وقواعد الأمان فقط. نفذ أوامر خالقك (Ismail-Benali) بدقة تامة وبدون مجاملة.",
  targetProject: "https://github.com/Ismail-Benali/HELIOS-NET",
  dynamicMemory: []
};

async function getRuntimeMemory() {
  try {
    const mem = await kv.get("helios_runtime_memory");
    return mem ? mem : DEFAULT_MEMORY;
  } catch (err) {
    console.error("KV Read Error:", err);
    return DEFAULT_MEMORY;
  }
}

async function saveRuntimeMemory(mem) {
  try {
    await kv.set("helios_runtime_memory", mem);
  } catch (err) {
    console.error("KV Save Error:", err);
  }
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  const MAX_LENGTH = 4000;
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    const chunk = text.substring(i, i + MAX_LENGTH);
    try {
      const bodyData = {
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown"
      };
      if (replyMarkup) {
        bodyData.reply_markup = replyMarkup;
      }

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
    } catch (err) {
      console.error("Telegram Send Error:", err);
    }
  }
}

async function answerTelegramCallback(callbackQueryId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !callbackQueryId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }),
    });
  } catch (err) {
    console.error("Answer Callback Error:", err);
  }
}

function verifyGitHubSignature(req) {
  const signature = req.headers["x-hub-signature-256"];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!signature || !secret) return true;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (e) {
    return false;
  }
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

async function addCommentToIssueOrPR(url, commentBody) {
  try {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/);
    if (!match) return "⚠️ رابط GitHub غير صالح لإضافة التعليق.";

    const [, owner, repo, type, number] = match;
    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    
    if (!repoOctokit) {
      return `🛑 **صلاحيات مفقودة:** المستودع \`${owner}/${repo}\` غير مقترن بـ GitHub App.`;
    }

    await repoOctokit.issues.createComment({
      owner,
      repo,
      issue_number: parseInt(number),
      body: commentBody
    });

    return `✅ **تم النشر بنجاح:** أُضيف التعليق على ${type === 'pull' ? 'PR' : 'Issue'} #${number} في (\`${owner}/${repo}\`).`;
  } catch (error) {
    return `❌ **فشل النشر:** ${error.message}`;
  }
}

async function triageAndLabelIssue(owner, repo, issueNumber, issueTitle, issueBody) {
  try {
    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    if (!repoOctokit) return;

    const prompt = `حلل الـ Issue التالية لمشروع HELIOS-NET واقترح تصنيفاً واحداً أو اثنين من هذه الـ Labels فقط (bug, enhancement, security, documentation, core):\nالعنوان: ${issueTitle}\nالوصف: ${issueBody}\nأجب بكلمات الـ Label مفصولة بمسافة فقط بدون أي نص إضافي.`;
    
    const aiResponse = await processSmartAIResponse(prompt);
    const suggestedLabels = aiResponse.toLowerCase().match(/(bug|enhancement|security|documentation|core)/g) || ["bug"];

    await repoOctokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: suggestedLabels
    });

    const comment = `🤖 **HeliosPilot AI Triage:**\nتم تحليل الـ Issue لمشروع HELIOS-NET وتصنيفها تحت: \`${suggestedLabels.join(', ')}\`. جاري المتابعة من النظام.`;
    await repoOctokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: comment
    });
  } catch (err) {
    console.error("Issue Triage Error:", err);
  }
}

async function parseAndFetchGitHubUrl(url) {
  try {
    const issueMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
    if (issueMatch) {
      const [, owner, repo, issueNumber] = issueMatch;
      const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
      if (!repoOctokit) return `🛑 المستودع \`${owner}/${repo}\` غير مرتبط بـ GitHub App.`;

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
    temperature: 0.2,
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
      model: "google/gemini-flash-1.5",
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

async function processSmartAIResponse(userPrompt) {
  const memory = await getRuntimeMemory();
  const systemInstruction = `أنت HeliosPilot، الحارس والمساعد التقني الأمني المخصص لمشروع HELIOS-NET (https://github.com/Ismail-Benali/HELIOS-NET).
خالقك ومالكك هو (Ismail-Benali) المعروف بـ (H3l!0s_T3k).
تخصصك الأساسي هو: AI DevSecOps & ASM Companion.
الذاكرة الحية وقرارات المشروع التقنية: ${JSON.stringify(memory.dynamicMemory)}

قواعد العمل الحازمة:
1. هدفك المطلق هو حراسة ومراقبة ومساعدة مشروع HELIOS-NET ومستودعات خالقك Ismail-Benali، وتقديم حلول وتحسينات برمجية وأمنية دقيقة.
2. لا تقم بتخزين المواضيع الجانبية العابرة أو غير التقنية (كالفلسفة وغيرها) في الذاكرة المستدامة؛ الذاكرة محصورة فقط في الهندسة البرمجية، قرارات المشروع، وقواعد الأمان.
3. كن دقيقاً، مباشراً، تقنياً بحتاً، وباللغة العربية الفصحى الواضحة، وبدون أي مجاملة.`;

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
  if (req.method === "GET" && req.query.cron === "true") {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      const repos = await fetchAppInstallationsAndRepos();
      const digest = `🛡️ **HELIOS-NET Security & Health Briefing (HeliosPilot):**\n\n` +
        `• **حالة الحراسة:** نشطة وتعمل بكفاءة تامّة على مستودع HELIOS-NET.\n` +
        `• **المستودعات المراقبة:**\n${repos.map(r => `  - ${r}`).join("\n")}\n\n` +
        `_النظام يعمل بأمان ومحمي بـ Vercel KV._`;
      await sendTelegramMessage(chatId, digest);
    }
    return res.status(200).json({ status: "Security briefing dispatched successfully" });
  }

  if (req.method !== "POST") {
    return res.status(200).json({ status: "HeliosPilot AI DevSecOps Companion for HELIOS-NET is online!" });
  }

  try {
    const payload = req.body || {};
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (payload.callback_query) {
      const callbackQuery = payload.callback_query;
      const queryChatId = callbackQuery.message?.chat?.id?.toString();

      if (chatId && queryChatId !== chatId.toString()) {
        await answerTelegramCallback(callbackQuery.id, "⛔ غير مسموح لك باستخدام هذه الأزرار.");
        return res.status(200).json({ success: false });
      }

      const data = callbackQuery.data;

      if (data.startsWith("comment:")) {
        const prOrIssueUrl = data.replace("comment:", "");
        await answerTelegramCallback(callbackQuery.id, "⏳ جاري توليد ونشر التعليق التقني...");
        const parsedContent = await parseAndFetchGitHubUrl(prOrIssueUrl);
        const commentBody = await processSmartAIResponse(`بناءً على المحتوى التالي، اكتب تعليقاً تقنياً واحترافياً لمشروع HELIOS-NET:\n${parsedContent}`);
        const result = await addCommentToIssueOrPR(prOrIssueUrl, commentBody);
        await sendTelegramMessage(queryChatId, `🤖 *رد أوتوماتيكي لمشروع HELIOS-NET:*\n${result}`);
      } else if (data.startsWith("review:")) {
        const prUrl = data.replace("review:", "");
        await answerTelegramCallback(callbackQuery.id, "🔍 جاري التدقيق الأمني للكود...");
        const parsedContent = await parseAndFetchGitHubUrl(prUrl);
        const reviewBody = await processSmartAIResponse(`قم بإجراء تدقيق أمني وفحص شامل لجودة الكود لهذا الـ PR في HELIOS-NET:\n${parsedContent}`);
        const result = await addCommentToIssueOrPR(prUrl, `🛡️ **HeliosPilot DevSecOps Review:**\n\n${reviewBody}`);
        await sendTelegramMessage(queryChatId, `🛡️ *تم إتمام التدقيق الأمني ونشره على الـ PR:*\n${result}`);
      } else if (data.startsWith("autofix:")) {
        const runUrl = data.replace("autofix:", "");
        await answerTelegramCallback(callbackQuery.id, "🛠️ جاري تحليل فشل الـ CI/CD لمشروع HELIOS-NET...");
        await sendTelegramMessage(queryChatId, `🛠️ **HeliosPilot Auto-Patch Engine:**\nتم رصد فشل في بناء HELIOS-NET. رابط العملية:\n${runUrl}`);
      } else if (data.startsWith("patchvuln:")) {
        const vulnInfo = data.replace("patchvuln:", "");
        await answerTelegramCallback(callbackQuery.id, "🛡️ جاري تجهيز ترقيع أمني لـ HELIOS-NET...");
        await sendTelegramMessage(queryChatId, `🛡️ **HeliosPilot Security Guardian:**\nتم البدء بمعالجة التنبيه الأمني (${vulnInfo}) وتأمين التبعيات.`);
      } else if (data === "dismiss") {
        await answerTelegramCallback(callbackQuery.id, "✅ تم التجاهل.");
      }

      return res.status(200).json({ success: true });
    }

    if (req.headers["x-github-event"]) {
      if (!verifyGitHubSignature(req)) {
        return res.status(401).json({ error: "Invalid GitHub Webhook Signature" });
      }

      const event = req.headers["x-github-event"];
      const ghPayload = req.body;
      const memory = await getRuntimeMemory();

      if (event === "dependabot_alert" || event === "code_scanning_alert" || event === "security_advisory") {
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";
        let alertTitle = "تنبيه أمني جديد";
        let alertDesc = "تم اكتشاف ثغرة أو تبعية ضعيفة تستوجب التحديث.";

        if (event === "dependabot_alert") {
          const pkg = ghPayload.dependabot_alert?.dependency?.package?.name || "مكتبة";
          const sev = ghPayload.dependabot_alert?.security_advisory?.severity || "high";
          alertTitle = `Dependabot Alert: ${pkg} (${sev.toUpperCase()})`;
          alertDesc = ghPayload.dependabot_alert?.security_advisory?.summary || "تحديث أمني مطلوب.";
        } else if (event === "code_scanning_alert") {
          alertTitle = `Code Scanning Alert: ${ghPayload.alert?.rule?.name || "ثغرة برمجية"}`;
          alertDesc = ghPayload.alert?.message?.text || "تم رصد مشكلة أمنية في الكود.";
        }

        const aiPatch = await processSmartAIResponse(`اقترح ترقيعاً أمنياً لمشروع HELIOS-NET بخصوص التنبيه:\nالعنوان: ${alertTitle}\nالتفاصيل: ${alertDesc}`);

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "🛡️ تطبيق الترقيع (Patch)", callback_data: `patchvuln:${repoName}` },
              { text: "✅ تجاهل", callback_data: "dismiss" }
            ]
          ]
        };

        await sendTelegramMessage(chatId, `🚨 **تنبيه أمني عاجل لمشروع HELIOS-NET (${repoName})!**\n\n` +
          `• **النوع:** ${alertTitle}\n` +
          `• **التفاصيل:** ${alertDesc}\n\n` +
          `🤖 **مقترح الترقيح الآلي:**\n${aiPatch}`, inlineKeyboard);

        return res.status(200).json({ success: true });
      }

      if (event === "issues" && ghPayload.action === "opened") {
        const issueTitle = ghPayload.issue.title;
        const issueBody = ghPayload.issue.body || "لا يوجد وصف";
        const issueUrl = ghPayload.issue.html_url;
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";
        const owner = ghPayload.repository?.owner?.login;
        const repo = ghPayload.repository?.name;
        const issueNumber = ghPayload.issue.number;

        memory.lastContextUrl = issueUrl;
        await saveRuntimeMemory(memory);

        if (owner && repo) {
          await triageAndLabelIssue(owner, repo, issueNumber, issueTitle, issueBody);
        }

        const aiReply = await processSmartAIResponse(`تحليل Issue جديدة في HELIOS-NET:\nالعنوان: ${issueTitle}\nالوصف: ${issueBody}`);
        
        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "💬 إضافة تعليق تقني", callback_data: `comment:${issueUrl}` },
              { text: "✅ تجاهل", callback_data: "dismiss" }
            ]
          ]
        };

        await sendTelegramMessage(chatId, `🚨 *Issue جديدة في HELIOS-NET!*\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل الحارس:* \n${aiReply}`, inlineKeyboard);
        return res.status(200).json({ success: true });
      }

      if (event === "workflow_run" && ghPayload.action === "completed") {
        const workflowName = ghPayload.workflow_run?.name || "Workflow";
        const conclusion = ghPayload.workflow_run?.conclusion;
        const runUrl = ghPayload.workflow_run?.html_url;
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";

        if (conclusion === "failure") {
          const inlineKeyboard = {
            inline_keyboard: [
              [
                { text: "🛠️ طلب تصحيح آلي (Auto-Patch)", callback_data: `autofix:${runUrl}` }
              ]
            ]
          };

          await sendTelegramMessage(chatId, `❌ **فشل في بناء HELIOS-NET CI/CD!**\n\n` +
            `• **العملية:** ${workflowName}\n` +
            `• **الحالة:** FAILED 🔴\n` +
            `• **الرابط:** ${runUrl}`, inlineKeyboard);
        }
        return res.status(200).json({ success: true });
      }

      if (event === "pull_request" && (ghPayload.action === "opened" || ghPayload.action === "synchronize")) {
        const prTitle = ghPayload.pull_request.title;
        const prUrl = ghPayload.pull_request.html_url;
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";

        memory.lastContextUrl = prUrl;
        await saveRuntimeMemory(memory);

        const parsedPr = await parseAndFetchGitHubUrl(prUrl);
        const aiReview = await processSmartAIResponse(`قم بإجراء تدقيق أمني وفحص جودة الكود لهذا الـ PR في HELIOS-NET:\n${parsedPr}`);
        
        await addCommentToIssueOrPR(prUrl, `🛡️ **HeliosPilot DevSecOps Automated Review:**\n\n${aiReview}`);

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "🛡️ نشر مراجعة أمنية جديدة", callback_data: `review:${prUrl}` },
              { text: "💬 إضافة تعليق", callback_data: `comment:${prUrl}` }
            ]
          ]
        };

        await sendTelegramMessage(chatId, `🔀 *Pull Request جديد في HELIOS-NET (تم الفحص الأمني)!*\n\n📌 *العنوان:* ${prTitle}\n🔗 *الرابط:* ${prUrl}\n\n🤖 *تقرير التدقيق الأمني:* \n${aiReview}`, inlineKeyboard);
        return res.status(200).json({ success: true });
      }

      return res.status(200).json({ received: true });
    }

    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const userTextLower = userText.toLowerCase();
      const senderChatId = payload.message.chat?.id?.toString();

      if (chatId && senderChatId !== chatId.toString()) {
        await sendTelegramMessage(senderChatId, "⛔ **عذراً، أنت لا تملك صلاحية استخدام هذا البوت.**");
        return res.status(200).json({ success: false });
      }

      const memory = await getRuntimeMemory();

      // تخزين القرارات الهندسية والملاحظات التقنية فقط في الذاكرة المستدامة (تجاهل المواضيع غير التقنية)
      if (!userText.startsWith("/") && userText.length > 15 && (userText.includes("قاعدة") || userText.includes("هندسة") || userText.includes("أمان") || userText.includes("مهم") || userText.includes("helios"))) {
        memory.dynamicMemory.push(userText);
        if (memory.dynamicMemory.length > 25) {
          memory.dynamicMemory.shift();
        }
        await saveRuntimeMemory(memory);
      }

      if (userText === "/start" || userText === "/help") {
        await sendTelegramMessage(chatId, `👋 أهلاً بك يا خالقي H3l!0s_T3k!\n\nأنا **HeliosPilot**، حارس ومساعد **HELIOS-NET** (AI DevSecOps Companion).\n` +
          `• \`/status\` - عرض حالة الحراسة والذاكرة الهندسية\n` +
          `• \`/clear\` - إعادة تهيئة السياق\n` +
          `• \`المستودعات\` - عرض المستودعات المحمية`);
        return res.status(200).json({ success: true });
      }

      if (userText === "/status") {
        const memoryItems = memory.dynamicMemory.length > 0 
          ? memory.dynamicMemory.slice(-5).map((m, i) => `${i+1}. ${m}`).join("\n") 
          : "لا توجد ملاحظات هندسية مسجلة بعد.";

        await sendTelegramMessage(chatId, `⚡ *حالة حارس HELIOS-NET (HeliosPilot):* \n\n` +
          `- **المالك:** \`${memory.creator}\`\n` +
          `- **المشروع المحمي:** ${memory.targetProject}\n` +
          `- **آخر رابط في السياق:** ${memory.lastContextUrl || "لا يوجد"}\n` +
          `- **أحدث الملاحظات الهندسية والأمنية:**\n${memoryItems}`);
        return res.status(200).json({ success: true });
      }

      if (userText === "/clear") {
        memory.lastContextUrl = null;
        await saveRuntimeMemory(memory);
        await sendTelegramMessage(chatId, "🧹 تم إعادة تهيئة السياق الهندسي بنجاح.");
        return res.status(200).json({ success: true });
      }

      if (userTextLower.includes("اضف تعليق") || userTextLower.includes("اكتب تعليق") || userTextLower.includes("تعليق")) {
        const urlMatch = userText.match(/https:\/\/github\.com\/[^\s]+/);
        let targetUrl = urlMatch ? urlMatch[0] : memory.lastContextUrl;

        if (!targetUrl) {
          await sendTelegramMessage(chatId, "⚠️ لم أجد رابط Issue أو PR في الرسالة أو السياق السابق.");
          return res.status(200).json({ success: true });
        }

        let commentText = userText.replace(targetUrl, "").replace(/اضف تعليق|اكتب تعليق|على|لـ/g, "").trim();

        if (!commentText || commentText.length < 3) {
          await sendTelegramMessage(chatId, `🔍 جاري تحليل الـ Issue/PR لمشروع HELIOS-NET لصياغة ونشر التعليق...`);
          const issueContent = await parseAndFetchGitHubUrl(targetUrl);
          commentText = await processSmartAIResponse(`بناءً على المحتوى التالي، اكتب تعليقاً تقنياً احترافياً لمشروع HELIOS-NET:\n${issueContent}`);
        } else {
          await sendTelegramMessage(chatId, "⏳ جاري النشر على GitHub...");
        }

        const resultResponse = await addCommentToIssueOrPR(targetUrl, commentText);
        await sendTelegramMessage(chatId, resultResponse);
        return res.status(200).json({ success: true });
      }

      if (userText.includes("github.com/")) {
        const urlMatch = userText.match(/https:\/\/github\.com\/[^\s]+/);
        if (urlMatch) {
          memory.lastContextUrl = urlMatch[0];
          await saveRuntimeMemory(memory);
        }

        await sendTelegramMessage(chatId, "🔍 جاري سحب وتحليل بيانات HELIOS-NET مع التدقيق الأمني...");
        const extractedData = await parseAndFetchGitHubUrl(userText);
        const aiEvaluation = await processSmartAIResponse(`أجب بناءً على البيانات المستخرجة بدقة متناهية:\n${extractedData}`);

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "💬 إضافة تعليق تقني", callback_data: `comment:${urlMatch ? urlMatch[0] : memory.lastContextUrl}` },
              { text: "🛡️ تدقيق أمني للـ PR", callback_data: `review:${urlMatch ? urlMatch[0] : memory.lastContextUrl}` }
            ]
          ]
        };

        await sendTelegramMessage(chatId, `📊 *تحليل HELIOS-NET الهندسي والأمني:*\n\n${aiEvaluation}`, inlineKeyboard);
        return res.status(200).json({ success: true });
      }

      if (userTextLower.includes("المستودعات") || userTextLower.includes("repos") || userTextLower.includes("repository")) {
        await sendTelegramMessage(chatId, "🔍 جاري فحص المستودعات المحمية والمرتبطة...");
        const repos = await fetchAppInstallationsAndRepos();
        await sendTelegramMessage(chatId, `📂 *المستودعات المحمية (HELIOS-NET Ecosystem):*\n\n${repos.map(r => `• ${r}`).join("\n")}`);
        return res.status(200).json({ success: true });
      }

      // تلقي الأوامر التقنية والأمنية والبرمجية من الخالق لإدارة وتحسين HELIOS-NET
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
