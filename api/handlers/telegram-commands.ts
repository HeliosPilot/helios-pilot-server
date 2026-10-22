import { sendTelegramMessage } from '../../services/telegram';
import { getTeamMemory, saveTeamMemory, isAdmin } from '../../services/memory';
import { processSmartAIResponse } from '../../services/ai';
import { fetchAppInstallationsAndRepos, fetchCodebaseContextForRAG, createBranch, createAutomatedPR } from '../../services/github';
import { generateHardenedFeature } from '../../services/feature-agent';

export async function handleTelegramCommand(cleanCmd, targetChatId, userText, userTextLower, memory) {
  if (cleanCmd === "/status") {
    const memoryItems = memory.dynamicMemory.length > 0 
      ? memory.dynamicMemory.slice(-5).map((m, i) => `${i + 1}. ${m}`).join("\n") 
      : "لا توجد ملاحظات هندسية مسجلة بعد.";
    await sendTelegramMessage(targetChatId, `⚡ *حالة حارس HELIOS-NET (Actions & Sentry Monitored):* \n\n` +
      `- **المالك:** \`${memory.creator}\`\n` +
      `- **المشروع المحمي:** ${memory.targetProject}\n` +
      `- **آخر رابط في السياق:** ${memory.lastContextUrl || "لا يوجد"}\n` +
      `- **أحدث الملاحظات الهندسية والأمنية:**\n${memoryItems}`);
    return true;
  }

  if (cleanCmd === "/clear") {
    memory.lastContextUrl = null;
    await saveTeamMemory(targetChatId, memory);
    await sendTelegramMessage(targetChatId, "🧹 تم إعادة تهيئة السياق الهندسي بنجاح. ⚡");
    return true;
  }

  if (cleanCmd === "/metrics") {
    await sendTelegramMessage(targetChatId, "🔧 **HeliosPilot Code Metrics**...\n\nجاري تحليل مقاييس الكود مع خبير 25 سنة...");
    const metrics = await processSmartAIResponse(`Analyze code metrics for HELIOS-NET: complexity, maintainability, and suggest improvements. Provide technical English comments only.`, memory.dynamicMemory);
    await sendTelegramMessage(targetChatId, `📊 *مقاييس HELIOS-NET المخضرم:*\n\n${metrics}`);
    return true;
  }

  if (cleanCmd.startsWith("/analyze-perf")) {
    const activeRepo = memory.userActiveRepos[targetChatId] || "Ismail-Benali/HELIOS-NET";
    await sendTelegramMessage(targetChatId, `🚀 *HeliosPilot Performance Analyzer:* جارٍ تحليل الكود في \`${activeRepo}\`...`);
    const [owner, repo] = activeRepo.split("/");
    const context = await fetchCodebaseContextForRAG(owner, repo);
    const analysis = await processSmartAIResponse(`Analyze this codebase for performance bottlenecks, time complexity, and inefficient operations. Provide concise optimization suggestions:\n${context}`, memory.dynamicMemory);
    await sendTelegramMessage(targetChatId, `⚡ *HeliosPilot Analysis:*\n\n${analysis}`);
    return true;
  }
  
  if (cleanCmd.startsWith("/feature ")) {
    if (!isAdmin(targetChatId, memory)) {
        await sendTelegramMessage(targetChatId, "⛔ غير مصرح لك بتنفيذ هذا الأمر.");
        return true;
    }
    const requirement = cleanCmd.replace("/feature ", "").trim();
    const activeRepo = memory.userActiveRepos[targetChatId] || "Ismail-Benali/HELIOS-NET";
    const [owner, repo] = activeRepo.split("/");
    
    await sendTelegramMessage(targetChatId, `🤖 **HeliosPilot Feature Agent:** جاري التخطيط والتوليد للميزة: \`${requirement}\`...`);
    
    const context = await fetchCodebaseContextForRAG(owner, repo);
    const result = await generateHardenedFeature(requirement, context, memory.dynamicMemory);
    
    if (result.success) {
        const branchName = `feat/${Date.now()}`;
        await createBranch(owner, repo, branchName);
        const prResult = await createAutomatedPR(owner, repo, "feature", result.code, "new-feature.js");
        await sendTelegramMessage(targetChatId, `✅ **تمت المهمة!** تم إنشاء الفرع \`${branchName}\` وفتح PR بالميزة الجديدة.\n${prResult}`);
    } else {
        await sendTelegramMessage(targetChatId, `❌ **فشل التوليد:** ${result.error}`);
    }
    return true;
  }
  
  return false;
}
