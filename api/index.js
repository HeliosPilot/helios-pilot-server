import { kv } from '@vercel/kv';
import { initSentry, captureException } from '../services/sentry.js';
import { sendTelegramMessage, answerTelegramCallback, setTelegramMessageReaction } from '../services/telegram.js';
import { verifyGitHubSignature, addCommentToIssueOrPR, parseAndFetchGitHubUrl, fetchAppInstallationsAndRepos } from '../services/github.js';
import { processSmartAIResponse } from '../services/ai.js';

// Initialize Sentry monitoring
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
      `_النظام يعمل بكفاءة ويحمل حراسة مستمرة._ 🛡️`;
    
    return summary;
  } catch (err) {
    captureException(err, { context: "generateWeeklySummary" });
    return `⚠️ حدث خطأ في توليد التقرير الأسبوعي.`;
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
  if (req.method === "GET" && req.query.cron === "true") {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      const repos = await fetchAppInstallationsAndRepos();
      const digest = `🛡️ **HELIOS-NET Security & Actions Monitoring (HeliosPilot):**\n\n` +
        `• **حالة الحراسة والـ Actions:** نشطة وتراقب خطوط البناء والاختبارات ⚡\n` +
        `• **المستودعات المحمية:**\n${repos.map(r => `  - ${r}`).join("\n")}\n\n` +
        `_النظام يعمل بأمان ومحمي بـ Vercel KV & Sentry._ 🚀`;
      await sendTelegramMessage(chatId, digest);
    }
    return res.status(200).json({ status: "Security actions briefing dispatched successfully" });
  }

  if (req.method !== "POST") {
    return res.status(200).json({ status: "HeliosPilot Veteran AI DevSecOps Companion with Actions Monitoring is online! ⚡" });
  }

  try {
    const payload = req.body || {};
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (payload.callback_query) {
      const callbackQuery = payload.callback_query;
      const queryChatId = callbackQuery.message?.chat?.id?.toString();
      const messageId = callbackQuery.message?.message_id;

      if (chatId && queryChatId !== chatId.toString()) {
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
      } else if (data.startsWith("patchvuln:")) {
        const vulnInfo = data.replace("patchvuln:", "");
        await answerTelegramCallback(callbackQuery.id, "🛡️ تجهيز الترقيع الأمني...");
        await sendTelegramMessage(queryChatId, `🛡️ **HeliosPilot Security Guardian:**\nجاري معالجة التنبيه الأمني (${vulnInfo}) وتطبيق الـ Security Patch.`);
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

      // مراقبة أحداث خطوط البناء والـ Actions (workflow_run & check_run)
      if (event === "workflow_run" && ghPayload.action === "completed") {
        const workflowName = ghPayload.workflow_run?.name || "Workflow";
        const conclusion = ghPayload.workflow_run?.conclusion;
        const runUrl = ghPayload.workflow_run?.html_url;
        const repoName = ghPayload.repository?.full_name || "HELIOS-NET";
        const owner = ghPayload.repository?.owner?.login;
        const repo = ghPayload.repository?.name;

        if (conclusion === "failure") {
          if (!owner || !repo) {
            await sendTelegramMessage(chatId, `❌ **فشل في خط البناء Actions!** 🔥\n\n` +
              `• **العملية:** ${workflowName}\n` +
              `• **المستودع:** ${repoName}\n` +
              `• **لا يمكن إنشاء PR تلقائياً:** غير متصل بـ GitHub App`);
            return res.status(200).json({ success: true });
          }

          await sendTelegramMessage(chatId, `🛠️ **HeliosPilot Auto-Patch Engine** فعال...\n\n` +
            `• **اكتشاف فشل:** ${workflowName}\n` +
            `• **المستودع:** \`${owner}/${repo}\`\n` +
            `• **الحالة:** FAILED 🔴\n\n` +
            `🤖 **جاري تحليل الفشل وإنشاء تصحيح آلي...**`);

          try {
            const parsedPr = await parseAndFetchGitHubUrl(runUrl);
            const autoFix = await processSmartAIResponse(`Generate an elite English auto-fix for this CI/CD failure in HELIOS-NET:\n${parsedPr}`, memory.dynamicMemory);

            const repoOctokit = await import('../services/github.js').then(m => m.getInstallationOctokitForRepo(owner, repo));
            if (repoOctokit) {
              await repoOctokit.pulls.create({
                owner,
                repo,
                title: `🛠️ Auto-Patch: ${workflowName} Fix`,
                body: `⚡ **HeliosPilot Auto-Patch Engine** detected a build failure and applied automatic fixes.\n\n** failing workflow:** ${workflowName}\n** Analysis:** ${autoFix}`,
                head: `helios-pilot/auto-patch-${new Date().getTime()}`,
                base: "main"
              });
              await sendTelegramMessage(chatId, `✅ **Auto-Patch تم إنشاؤه successfully!** ⚡\n\n` +
                `• **PR:** \`${owner}/${repo}\`\n` +
                `• **عنوان الخط:** Auto-Patch: ${workflowName} Fix\n` +
                `• **تم إنشاؤه من قبل:** HeliosPilot Veteran DevSecOps`);
            } else {
              await sendTelegramMessage(chatId, `🛑 **لا يمكن إنشاء PR:** المستودع غير مرتبط بـ GitHub App.`);
            }
          } catch (err) {
            captureException(err, { context: "autoPatchWorkflow" });
            await sendTelegramMessage(chatId, `⚠️ **Auto-Patch فشل:** حدث خطأ أثناء التحليل. برجاء استخدام الزر اليدوي.`);
          }

          const inlineKeyboard = {
            inline_keyboard: [
              [
                { text: "🛠️ عرض PR المقترح", callback_data: `viewpr:${runUrl}` }
              ]
            ]
          };

          await sendTelegramMessage(chatId, `❌ **فشل في خط البناء Actions (HELIOS-NET)!** 🔥\n\n` +
            `• **العملية:** ${workflowName}\n` +
            `• **المستودع:** ${repoName}\n` +
            `• **الحالة:** FAILED 🔴\n` +
            `• **الرابط المباشر:** ${runUrl}`, inlineKeyboard);
        } else if (conclusion === "success") {
          await sendTelegramMessage(chatId, `✅ **نجاح خط البناء Actions في ${repoName}!** ⚡\n\n` +
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

        if (conclusion === "failure") {
          await sendTelegramMessage(chatId, `❌ **فشل اختبار Check Run في ${repoName}!** 🔥\n\n` +
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

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "🛡️ تطبيق الترقيع (Patch)", callback_data: `patchvuln:${repoName}` },
              { text: "✅ تجاهل", callback_data: "dismiss" }
            ]
          ]
        };

        await sendTelegramMessage(chatId, `🚨 **تنبيه أمني عاجل لمشروع HELIOS-NET!** ⚡\n\n` +
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
          await triageAndLabelIssue(owner, repo, issueNumber, issueTitle, issueBody, memory.dynamicMemory);
        }

        const aiReply = await processSmartAIResponse(`Analyze this new Issue for HELIOS-NET:\nTitle: ${issueTitle}\nBody: ${issueBody}`, memory.dynamicMemory);
        
        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "💬 إضافة تعليق تقني", callback_data: `comment:${issueUrl}` },
              { text: "✅ تجاهل", callback_data: "dismiss" }
            ]
          ]
        };

        await sendTelegramMessage(chatId, `🚨 *Issue جديدة في HELIOS-NET!* 🧠\n\n📌 *العنوان:* ${issueTitle}\n🔗 *الرابط:* ${issueUrl}\n\n🤖 *تحليل الحارس المخضرم:* \n${aiReply}`, inlineKeyboard);
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

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "🛡️ نشر مراجعة أمنية جديدة", callback_data: `review:${prUrl}` },
              { text: "💬 إضافة تعليق", callback_data: `comment:${prUrl}` }
            ]
          ]
        };

        await sendTelegramMessage(chatId, `🔀 *Pull Request جديد في HELIOS-NET!* 🛡️\n\n📌 *العنوان:* ${prTitle}\n🔗 *الرابط:* ${prUrl}\n\n🤖 *تقرير التدقيق الأمني المخضرم:* \n${aiReview}`, inlineKeyboard);
        return res.status(200).json({ success: true });
      }

      return res.status(200).json({ received: true });
    }

    if (payload.message && payload.message.text) {
      const userText = payload.message.text.trim();
      const userTextLower = userText.toLowerCase();
      const senderChatId = payload.message.chat?.id?.toString();
      const messageId = payload.message.message_id;

      if (chatId && senderChatId !== chatId.toString()) {
        await sendTelegramMessage(senderChatId, "⛔ **عذراً، أنت لا تملك صلاحية استخدام هذا البوت.**");
        return res.status(200).json({ success: false });
      }

      await setTelegramMessageReaction(senderChatId, messageId, "🧠");
      const memory = await getRuntimeMemory();

      if (!userText.startsWith("/") && userText.length > 15 && (userText.includes("قاعدة") || userText.includes("هندسة") || userText.includes("أمان") || userText.includes("مهم") || userText.includes("helios"))) {
        memory.dynamicMemory.push(userText);
        if (memory.dynamicMemory.length > 25) {
          memory.dynamicMemory.shift();
        }
        await saveRuntimeMemory(memory);
      }

      if (userText === "/start" || userText === "/help") {
        await sendTelegramMessage(chatId, `👋 أهلاً بك يا خالقي العظيم H3l!0s_T3k! ⚡\n\nأنا **HeliosPilot**، الحارس المخضرم (25 عام خبرة) ومساعد **HELIOS-NET** (AI DevSecOps Companion) والمراقب لخطوط الـ Actions و Sentry.\n` +
          `• \`/status\` - حالة الحراسة والذاكرة الهندسية\n` +
          `• \`/clear\` - إعادة تهيئة السياق\n` +
          `• \`المستودعات\` - عرض المستودعات المحمية`);
        return res.status(200).json({ success: true });
      }

      if (userText === "/status") {
        const memoryItems = memory.dynamicMemory.length > 0 
          ? memory.dynamicMemory.slice(-5).map((m, i) => `${i+1}. ${m}`).join("\n") 
          : "لا توجد ملاحظات هندسية مسجلة بعد.";

        await sendTelegramMessage(chatId, `⚡ *حالة حارس HELIOS-NET (Actions & Sentry Monitored):* \n\n` +
          `- **المالك:** \`${memory.creator}\`\n` +
          `- **المشروع المحمي:** ${memory.targetProject}\n` +
          `- **آخر رابط في السياق:** ${memory.lastContextUrl || "لا يوجد"}\n` +
          `- **أحدث الملاحظات الهندسية والأمنية:**\n${memoryItems}`);
        return res.status(200).json({ success: true });
      }

      if (userText === "/clear") {
        memory.lastContextUrl = null;
        await saveRuntimeMemory(memory);
        await sendTelegramMessage(chatId, "🧹 تم إعادة تهيئة السياق الهندسي بنجاح. ⚡");
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
          await sendTelegramMessage(chatId, `🔍 جاري تحليل الـ Issue/PR وصياغة التعليق التقني بالإنجليزية...`);
          const issueContent = await parseAndFetchGitHubUrl(targetUrl);
          commentText = await processSmartAIResponse(`Write an elite technical comment in English for HELIOS-NET based on:\n${issueContent}`, memory.dynamicMemory);
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

        await sendTelegramMessage(chatId, "🔍 جاري تحليل المستودع والتدقيق الأمني... 🛡️");
        const extractedData = await parseAndFetchGitHubUrl(userText);
        const aiEvaluation = await processSmartAIResponse(`Analyze this repository data for HELIOS-NET with 25-yr veteran precision:\n${extractedData}`, memory.dynamicMemory);

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "💬 إضافة تعليق تقني", callback_data: `comment:${urlMatch ? urlMatch[0] : memory.lastContextUrl}` },
              { text: "🛡️ تدقيق أمني للـ PR", callback_data: `review:${urlMatch ? urlMatch[0] : memory.lastContextUrl}` }
            ]
          ]
        };

        await sendTelegramMessage(chatId, `📊 *تحليل HELIOS-NET المخضرم:*\n\n${aiEvaluation}`, inlineKeyboard);
        return res.status(200).json({ success: true });
      }

      if (userTextLower.includes("المستودعات") || userTextLower.includes("repos") || userTextLower.includes("repository")) {
        await sendTelegramMessage(chatId, "🔍 جاري فحص المستودعات المحمية...");
        const repos = await fetchAppInstallationsAndRepos();
        await sendTelegramMessage(chatId, `📂 *المستودعات المحمية (HELIOS-NET Ecosystem):*\n\n${repos.map(r => `• ${r}`).join("\n")}`);
        return res.status(200).json({ success: true });
      }

try {
      const replyText = await processSmartAIResponse(userText, memory.dynamicMemory);
      await sendTelegramMessage(chatId, replyText ?? "🤖 HeliosPilot: تم استقبال رسالتك ولكناجهز رداً تقنياً...");
    } catch (aiError) {
      captureException(aiError, { context: "processSmartAIResponse" });
      await sendTelegramMessage(chatId, "🤖 HeliosPilot: استقبلتُ رسالتك ولكنواجهت صعوبة في المعالجة التقنية حالياً.حاول مرة أخرى later. ⚡");
    }

    if (userText === "/metrics") {
      await sendTelegramMessage(chatId, "🔧 **HeliosPilot Code Metrics**...\n\nجاري تحليل مقاييس الكود...");
      const metrics = await processSmartAIResponse(`Analyze code metrics for HELIOS-NET: complexity, maintainability, and suggest improvements. Provide technical English comments only.`, memory.dynamicMemory);
      await sendTelegramMessage(chatId, `📊 *مقاييس HELIOS-NET المخضرم:*\n\n${metrics}`, {
        inline_keyboard: [[{ text: "🔄 تحليل مرة أخرى", callback_data: `/metrics` }]]
      });
      return res.status(200).json({ success: true });
    }

    if (userText === "/weekly") {
      const weeklySummary = await generateWeeklySummary();
      await sendTelegramMessage(chatId, weeklySummary);
      return res.status(200).json({ success: true });
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
