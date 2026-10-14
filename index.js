import OpenAI from "openai";

// إعداد الاتصال بنموذج DeepSeek عبر NVIDIA NIM
const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export default (app) => {
  app.log.info("HeliosPilot App is online and listening!");

  // التفاعل فور فتح Issue جديدة
  app.on("issues.opened", async (context) => {
    const issueTitle = context.payload.issue.title;
    const issueBody = context.payload.issue.body || "لا يوجد وصف متوفر.";

    app.log.info(`Processing new issue: ${issueTitle}`);

    try {
      // طلب تحليل المشكلة والرد عليها من DeepSeek
      const completion = await openai.chat.completions.create({
        model: "deepseek-ai/deepseek-r1",
        messages: [
          {
            role: "system",
            content: "أنت HeliosPilot، مطور ذكاء اصطناعي خبير ومساهم رسمي في مشروع HELIOS-NET. قدّم إجابات وحلولاً برمجية تقنية دقيقة ومباشرة باللغة العربية أو الإنجليزية حسب لغة المشكلة."
          },
          {
            role: "user",
            content: `عنوان المشكلة: ${issueTitle}\nتفاصيل المشكلة:\n${issueBody}`
          }
        ],
        temperature: 0.6,
        max_tokens: 2048,
      });

      const aiReply = completion.choices[0].message.content;

      // نشر التعليق في GitHub باسم HeliosPilot
      const issueComment = context.issue({
        body: `🤖 **HeliosPilot AI:**\n\n${aiReply}`
      });

      await context.octokit.issues.createComment(issueComment);
    } catch (error) {
      app.log.error("Error with DeepSeek API or GitHub API:", error);
    }
  });
};
