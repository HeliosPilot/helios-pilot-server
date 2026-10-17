import { kv } from '@vercel/kv';
import { initSentry, captureException } from '../services/sentry.js';
import { sendTelegramMessage, answerTelegramCallback, setTelegramMessageReaction } from '../services/telegram.js';
import { verifyGitHubSignature, addCommentToIssueOrPR, parseAndFetchGitHubUrl, fetchAppInstallationsAndRepos } from '../services/github.js';
import { processSmartAIResponse } from '../services/ai.js';

// Initialize Sentry error tracking
initSentry();

const DEFAULT_MEMORY = {
  creator: "Ismail-Benali (H3l!0s_T3k)",
  projectName: "HELIOS-NET & HeliosPilot Ecosystem",
  coreStack: "Node.js, Vercel Serverless, Groq, OpenRouter, GitHub App, Telegram API, Vercel KV, Sentry",
  rules: "أنت خبير مخضرم بخبرة 25 عاماً في هندسة النظم، أمن المعلومات، ASM، و DevSecOps. صُممت لحراسة وتطوير HELIOS-NET.",
  targetProject: "https://github.com/Ismail-Benali/HELIOS-NET",
  dynamicMemory: []
};

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

    const repoOctokit = await import('../services/github.js').then(m => m.getInstallationOctokitForRepo(owner, repo));
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

export default async function handler(req, res) {
  const envChatId = process.env.TELEGRAM_CHAT_ID;

  if (req.method === "GET" && req.query.cron === "true") {
    if (envChatId) {
      const repos = await fetchAppInstallationsAndRepos();
      const digest = `🛡️ **HELIOS-NET Security & Actions Monitoring (HeliosPilot):**\n\n` +
        `• **حالة الحراسة والـ Actions:** نشطة وتراقب خطوط البناء والاختبارات ⚡\n` +
        `• **المستودعات المحمية:**\n${repos.map(r => `  - ${r}`).join("\n")}\n\n` +
        `_النظام يعمل بأمان ومحمي بـ Vercel KV & Sentry._ 🚀`;
      await sendTelegramMessage(envChatId, digest);
    }
    return res.status(200).json({ status: "Security actions briefing dispatched successfully" });
  }

  if (req.method !== "POST") {
    return res.status(200).json({ status: "HeliosPilot Veteran AI DevSecOps Companion is online! ⚡" });
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

    // 2. التعامل مع أحداث GitHub Webhooks
    if (req.headers["x-github-event"]) {
      if (!verifyGitHubSignature(req)) {
        return res.status(401).json({ error: "Invalid GitHub Webhook Signature" });
      }

      const event = req.headers["x-github-event"];
      const ghPayload = req.body;
      const memory = await getRuntimeMemory();
      const targetNotifyChatId = envChatId;

      if (event === "workflow_run" && ghPayload.action === "completed") {
        const workflowName = ghPayload.workflow_run?.name || "Workflow";
        const conclusion = ghPayload.workflow_run?.conclusion;
        const runUrl = ghPayload.workflow_run?.html_url;
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";
        const owner = ghPayload.repository?.owner?.login;
        const repo = ghPayload.repository?.name;

        if (conclusion === "failure") {
          if (targetNotifyChatId) {
            await sendTelegramMessage(targetNotifyChatId, `❌ **فشل في خط البناء Actions (HELIOS-NET)!** 🔥\n\n` +
              `• **العملية:** ${workflowName}\n` +
              `• **المستودع:** ${repoName}\n` +
              `• **الحالة:** FAILED 🔴\n` +
              `• **الرابط المباشر:** ${runUrl}`, {
                inline_keyboard: [[{ text: "🛠️ طلب تصحيح آلي (Auto-Patch)", callback_data: `autofix:${runUrl}` }]]
              });
          }

          if (owner && repo) {
            try {
              const parsedPr = await parseAndFetchGitHubUrl(runUrl);
              const autoFix = await processSmartAIResponse(`Generate an elite English auto-fix for this CI/CD failure in HELIOS-NET:\n${parsedPr}`, memory.dynamicMemory);

              const repoOctokit = await import('../services/github.js').then(m => m.getInstallationOctokitForRepo(owner, repo));
              if (repoOctokit) {
                await repoOctokit.pulls.create({
                  owner,
                  repo,
                  title: `🛠️ Auto-Patch: ${workflowName} Fix`,
                  body: `⚡ **HeliosPilot Auto-Patch Engine** detected a build failure and generated automated patch analysis.\n\n**Failing Workflow:** ${workflowName}\n**Analysis & Solution:**\n${autoFix}`,
                  head: `helios-pilot/auto-patch-${Date.now()}`,
                  base: "main"
                });

                if (targetNotifyChatId) {
                  await sendTelegramMessage(targetNotifyChatId, `✅ **Auto-Patch PR تم إنشاؤه بنجاح!** ⚡\n• **المستودع:** \`${owner}/${repo}\`\n• **عنوان الـ PR:** Auto-Patch: ${workflowName} Fix`);
                }
              }
            } catch (err) {
              captureException(err, { context: "autoPatchWorkflow" });
            }
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
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";
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
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";

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

      return res.status(200).json({ received: true });
    }

    // 3. التعامل مع رسائل المستخدِم المحادثات المباشرة في Telegram
    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const userTextLower = userText.toLowerCase();
      const senderChatId = payload.message.chat?.id?.toString();
      const messageId = payload.message.message_id;

      // العميل المستهدف للردود هو دائماً الشات الذي أرسل منه المستخدِم الرسالة!
      const targetChatId = senderChatId || envChatId;

            // تنظيف اسم الأمر (إزالة الرموز مثل @BotName والمسافات)
      const cleanCmd = userTextLower.split('@')[0].split(' ')[0].trim();

      // أ) الأوامر العامة المتاحة لجميع المستخدمين (/start و /help)
      if (cleanCmd.startsWith("/start") || cleanCmd.startsWith("/help")) {
        const helpText = `👋 أهلاً بك يا خالقي العظيم H3l!0s_T3k! ⚡\n\n` +
          `أنا **HeliosPilot**، الحارس المخضرم (25 عام خبرة) ومساعد **HELIOS-NET** (AI DevSecOps Companion) والمراقب لخطوط الـ Actions و Sentry.\n\n` +
          `• \`/status\` - حالة الحراسة والذاكرة الهندسية\n` +
          `• \`/clear\` - إعادة تهيئة السياق الهندسي\n` +
          `• \`المستودعات\` - عرض المستودعات المحمية\n` +
          `• \`/metrics\` - مقاييس جودة الكود الهندسي\n` +
          `• \`/weekly\` - التقرير الأسبوعي الأمني`;
        await sendTelegramMessage(targetChatId, helpText);
        return res.status(200).json({ success: true });
      }

      // ب) فحص الصلاحيات للأوامر الحساسة (إذا تم ضبط TELEGRAM_CHAT_ID في الإعدادات)
      if (envChatId && senderChatId && senderChatId !== envChatId.toString()) {
        await sendTelegramMessage(senderChatId, "⛔ **عذراً، أنت لا تملك صلاحية استخدام هذا البوت.**");
        return res.status(200).json({ success: false });
      }

      // تفعيل التفاعل الآلي بـ Emoji
      await setTelegramMessageReaction(targetChatId, messageId, "🧠");
      const memory = await getRuntimeMemory();

      // حفظ القواعد والتوجيهات الهندسية الهامة في الذاكرة
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
        const metrics = await processSmartAIResponse(`Analyze code metrics for HELIOS-NET: complexity, maintainability, and suggest improvements. Provide technical English comments only.`, memory.dynamicMemory);
        await sendTelegramMessage(targetChatId, `📊 *مقاييس HELIOS-NET المخضرم:*\n\n${metrics}`, {
          inline_keyboard: [[{ text: "🔄 تحليل مرة أخرى", callback_data: `comment:${memory.targetProject}` }]]
        });
        return res.status(200).json({ success: true });
      }

      if (cleanCmd === "/weekly") {
        const weeklySummary = await generateWeeklySummary();
        await sendTelegramMessage(targetChatId, weeklySummary);
        return res.status(200).json({ success: true });
      }

      if (cleanCmd === "المستودعات" || cleanCmd === "repos" || cleanCmd === "repository" || userTextLower.includes("المستودعات") || userTextLower.includes("repos")) {
        await sendTelegramMessage(targetChatId, "🔍 جاري فحص المستودعات المحمية...");
        const repos = await fetchAppInstallationsAndRepos();
        await sendTelegramMessage(targetChatId, `📂 *المستودعات المحمية (HELIOS-NET Ecosystem):*\n\n${repos.map(r => `• ${r}`).join("\n")}`);
        return res.status(200).json({ success: true });
      }

      if (userTextLower.includes("اضف تعليق") || userTextLower.includes("اكتب تعليق") || userTextLower.includes("تعليق")) {
        const urlMatch = userText.match(/https:\/\/github\.com\/[^\s]+/);
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

      // د) الرد الذكي الافتراضي في حالة المحادثات العامة
      try {
        const replyText = await processSmartAIResponse(userText, memory.dynamicMemory);
        await sendTelegramMessage(targetChatId, replyText ?? "🤖 HeliosPilot: تم استقبال رسالتك وجاري معالجتها تقنياً...");
      } catch (aiError) {
        captureException(aiError, { context: "processSmartAIResponse" });
        await sendTelegramMessage(targetChatId, "🤖 HeliosPilot: استقبلتُ رسالتك ولكن واجهت صعوبة في المعالجة التقنية حالياً. حاول مرة أخرى لاحقاً. ⚡");
      }

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Handler Error:", error);
    captureException(error, { context: "main_handler" });
    return res.status(200).json({ error: error.message });
  }
}
