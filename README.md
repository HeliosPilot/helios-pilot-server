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

| Command | Description |
|---------|-------------|
| `/start` | Initialize the bot and greetings |
| `/help` | Show available commands and features |
| `/status` | Check system status and memory |
| `/clear` | Reset context and memory |
| `/gif` *(Deprecated)* | Test GIF sending |

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