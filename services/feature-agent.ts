import { processSmartAIResponse } from './ai';
import { captureException } from './sentry';

export async function generateHardenedFeature(requirement, codebaseContext, memory) {
  try {
    // المرحلة الأولى: التوليد
    const initialCode = await processSmartAIResponse(
      `Generate feature implementation for: ${requirement}. Follow strict clean code, secure practices, and maintain project style.\nContext:\n${codebaseContext}`,
      memory
    );

    // المرحلة الثانية: المراجعة الأمنية والتقنية الصارمة
    const auditResult = await processSmartAIResponse(
      `Audit the following code for security vulnerabilities, OWASP top 10, syntax errors, and style violations. Reply with "SECURE" if it passes, or explain the issues to be fixed if it fails.\nCode:\n${initialCode}`,
      []
    );

    if (auditResult.includes("SECURE")) {
      return { success: true, code: initialCode };
    } else {
      // حلقة تصحيح بسيطة (مرة واحدة فقط)
      const fixedCode = await processSmartAIResponse(
        `Fix the following code based on these issues:\n${auditResult}\n\nCode:\n${initialCode}`,
        []
      );
      return { success: true, code: fixedCode };
    }
  } catch (err) {
    captureException(err, { context: "generateHardenedFeature" });
    return { success: false, error: err.message };
  }
}
