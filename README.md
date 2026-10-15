# HeliosPilot - AI DevSecOps Companion

![HeliosPilot Logo](https://raw.githubusercontent.com/HeliosPilot/helios-pilot-server/main/api/index.js) <!-- Placeholder -->

> **HeliosPilot** is an intelligent Telegram bot that monitors your GitHub repositories, analyzes code, and provides DevSecOps expertise with 25 years of experience. It combines Sentry error tracking, GitHub Actions monitoring, and AI-powered code analysis to keep your projects secure and running smoothly.

## 🚀 Features

- **🛡️ GitHub Actions Monitoring**: Watch CI/CD pipelines and detect failures instantly
- **🔍 Code Analysis**: AI-powered code reviews and security audits
- **📊 Security Alerts**: Dependabot and code scanning alerts integration
- **💬 Telegram Integration**: Full control and notifications via Telegram
- **🧠 Dynamic Memory**: Remembers context and learns from your projects
- **📈 Sentry Error Tracking**: Captures and reports application errors
- **⚡ 25-Year Veteran Persona**: Expert-level technical guidance in English

## 📦 Installation

### Prerequisites

- Node.js >= 18.x
- Telegram Bot Token (from @BotFather)
- GitHub App credentials (for Actions monitoring)
- Sentry DSN (for error tracking)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ismail-Benali/helios-pilot-server.git
   cd helios-pilot-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file with:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   GROQ_API_KEY=your_groq_key
   OPENROUTER_API_KEY=your_openrouter_key
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   APP_ID=your_github_app_id
   PRIVATE_KEY=your_github_private_key
   SENTRY_DSN=your_sentry_dsn
   ```

4. **Deploy:**
   ```bash
   npm run dev
   # Or deploy to Vercel
   ```

## 🛠️ Usage

### Telegram Commands

| Command | Arabic Description | English Description | Example | Result |
|---------|-------------------|---------------------|---------|--------|
| `/start` | بدء التشغيل والترحيب بالبوت | Initialize the bot and greetings | اكتب `/start` | 👋 أهلاً بك يا خالقي العظيم H3l!0s_T3k! ⚡ أنا **HeliosPilot**، الحارس المخضرم (25 عام خبرة) ومساعد **HELIOS-NET** (AI DevSecOps Companion) والمراقب لخطوط الـ Actions و Sentry. |
| `/help` | عرض الأوامر والميزات المتاحة | Show available commands and features | اكتب `/help` | قائمة بجميع الأوامر مع الشرح (هذه الجدول). |
| `/status` | حالة الحارس والذاكرة الهندسية | Check system status and memory | اكتب `/status` | ⚡ *حالة حارس HELIOS-NET (Actions & Sentry Monitored):*\n\n`- **المالك:** \`Ismail-Benali\`\n`- **المشروع المحمي:** https://github.com/Ismail-Benali/HELIOS-NET\n`- **آخر رابط في السياق:** لا يوجد\n`- **أحدث الملاحظات الهندسية والأمنية:** لا توجد ملاحظات مسجلة.` |
| `/clear` | إعادة تهيئة السياق والمسح | Reset context and memory | اكتب `/clear` | 🧹 تم إعادة تهيئة السياق الهندسي بنجاح. ⚡ |
| `/metrics` | مقاييس جودة الكود (جديد) | Code quality metrics (new) | اكتب `/metrics` | 📊 *مقاييس HELIOS-NET المخضرم:*\n\n⚠️ **Complexity:** 45 (الحد: 20)\n📈 **Coverage:** 78% (الحد: 80%)\n🔁 **Duplication:** 12% (الحد: <10%)\n📝 **Technical Debt:** 15 ساعة\n🟢 **Functions صحية:** 67🔴 **Functions needing review:** 23 |
| `/weekly` | التقرير الأسبوعي (جديد) | Weekly report (new) | اكتب `/weekly` | 📊 *ملخص أسبوعي HELIOS-NET* ⚡\n\n`- **المالك:** \`Ismail-Benali\`\n`- **المشروع:** HELIOS-NET\n`- **المستودعات المحمية:** 1 مستودع\n`- **اتجاه التعقيد:** ↗️ زيادة ( +5 هذا الأسبوع )\n`- **اتجاه التغطية:** ↘️ انخفاض ( -2% هذا الأسبوع )\n`- **تنبيهات أمنية:** 0 نتائج جديدة\n`- **المطورون النشطون:** 3\n`- **التبعيات:** 42총 (2 قديمة)` |
| `/gif` *(Deprecated)* | اختبار إرسال صور GIF (ملغى) | Test GIF sending (deprecated) | اكتب `/gif` | ⚠️ تم إلغاء 명령 GIF، استخدم الصور العادية. |

**ملاحظة:** أوامر `/metrics` و `/weekly` تتطلب تفعيل خصائص جودة الكود في إعدادات GitHub App والمستودع.

### GitHub Webhooks

Add a webhook to your GitHub repository:
- **URL**: Your Vercel deployment URL
- **Events**: 
  - `workflow_run`
  - `check_run`
  - `issues`
  - `pull_request`
  - `dependabot_alert`
  - `code_scanning_alert`

## 🏗️ Architecture

```
HeliosPilot Serverless Architecture
├── api/index.js          # Main handler (Express/Vercel Serverless)
├── services/
│   ├── ai.js            # Groq/OpenRouter AI integration
│   ├── github.js        # GitHub API client
│   ├── telegram.js      # Telegram Bot API
│   └── sentry.js        # Sentry error tracking
└── package.json          # Dependencies and scripts
```

## 📡 Supported GitHub Events

- `workflow_run` - CI/CD pipeline status
- `check_run` - Test suite results
- `issues` - Issue creation and updates
- `pull_request` - PR reviews and updates
- `dependabot_alert` - Dependency vulnerability alerts
- `code_scanning_alert` - Code security alerts

## 👥 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with ❤️ by Ismail-Benali
- Powered by Groq & OpenRouter AI
- GitHub Actions integration
- Sentry error monitoring
- Telegram Bot API

---

**HeliosPilot** - Protecting HELIOS-NET since 2026 ⚡🛡️