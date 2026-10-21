# HeliosPilot - AI DevSecOps Companion

HeliosPilot is a serverless Telegram bot and dashboard for monitoring GitHub repositories, reviewing code, and assisting with DevSecOps workflows. It connects Telegram, GitHub webhooks, Vercel KV, Sentry, and AI providers (Groq / OpenRouter) in one deployment.

## Features

- GitHub Actions, issue, pull request, Dependabot, and code-scanning monitoring
- AI-powered code review, security analysis, and repository Q&A
- Persistent runtime memory backed by Vercel KV
- Protected dashboard with health checks, command runner, charts, and memory editor
- Telegram commands for status, metrics, wiki generation, and auto-fix workflows
- Optional Sentry error tracking
- Health and connectivity endpoints

## Architecture

```text
api/
  index.js          Main Telegram + GitHub webhook handler
  dashboard.js      Token-protected dashboard HTML endpoint
  memory.js         Token-protected memory read/write endpoint
services/
  security.js       Token comparison, rate limiting, audit logging
  ai.js             Groq / OpenRouter fallback
  github.js         GitHub App + REST integration
  memory.js         Vercel KV memory storage
  sentry.js         Error tracking
  telegram.js       Telegram Bot API
  trello.js         Trello integration
views/
  dashboard.html    Dashboard UI
index.html          English landing page
ar/index.html       Arabic landing page
```

## Requirements

- Node.js 18 or newer
- Telegram bot token
- GitHub App credentials
- Vercel KV (for memory and rate limiting)
- Optional: Sentry DSN, Groq/OpenRouter API keys

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
GROQ_API_KEY=
OPENROUTER_API_KEY=
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
SENTRY_DSN=
DASHBOARD_TOKEN=
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

`DASHBOARD_TOKEN` is required for `/dashboard.html` and `/api/memory`. The dashboard fails closed when it is missing.

`TELEGRAM_WEBHOOK_SECRET` is strongly recommended. When it is not set, the API cannot verify Telegram webhook authenticity and logs a warning.

## Local Development

```bash
npm install
npm run check
npm test
```

There is no local HTTP server script. Deploy to Vercel or use the Vercel CLI for a full local preview:

```bash
npx vercel dev
```

## Dashboard

Open:

```text
https://<your-deployment>/dashboard.html
```

Enter the value of `DASHBOARD_TOKEN`. The dashboard loads through `/api/dashboard?token=...` and its API calls send the token through the `x-dashboard-token` header.

Dashboard capabilities:

- Service health cards
- Bot and Telegram connectivity tests
- API latency and session charts
- Command runner with numbered command selection
- Persistent memory editor with Save / Clear
- JSON log export

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api` | Telegram webhook, GitHub webhook, and dashboard commands |
| GET | `/api?health=true` | Service health |
| GET | `/api?test=true` | Connectivity test |
| GET | `/api/dashboard?token=...` | Protected dashboard HTML |
| GET | `/api/memory` | Read runtime memory (token required) |
| POST | `/api/memory` | Save or clear runtime memory (token required) |

## Telegram Commands

| Command | Purpose |
| --- | --- |
| `/start` / `/help` | Show help |
| `/status` | Show system and memory status |
| `/clear` | Clear the last context |
| `/metrics` | Request code metrics |
| `/weekly` | Generate a weekly summary |
| `/createwiki` | Generate `WIKI.md` and open a PR |
| `/autofix` | Scan security alerts and propose a patch |
| `repos` | List connected repositories |

## Security Notes

- Dashboard and memory endpoints require `DASHBOARD_TOKEN` and fail closed if it is absent.
- Memory writes require the `x-dashboard-token` header.
- Dashboard and dashboard-command requests are rate limited through Vercel KV.
- Memory changes and dashboard commands are written to the `helios_audit_log` KV entry.
- GitHub webhooks are verified with `GITHUB_WEBHOOK_SECRET`.
- Set `TELEGRAM_WEBHOOK_SECRET` to verify Telegram webhook requests.

## Testing

```bash
npm run check
npm test
```

CI runs both commands on every push and pull request to `main`.

## License

MIT. See [LICENSE](LICENSE).

---

## نظرة سريعة بالعربية

HeliosPilot بوت Telegram ولوحة تحكم Serverless لمراقبة GitHub وتحليل الكود وإدارة الذاكرة. لوحة التحكم محمية بـ `DASHBOARD_TOKEN`، والذاكرة محفوظة في Vercel KV. شغّل `npm run check` و`npm test` قبل النشر.
