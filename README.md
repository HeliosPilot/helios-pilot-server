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
  index.ts          Main Telegram + GitHub webhook handler
  dashboard.ts      Dashboard HTML endpoint (UI only; API data stays protected)
  memory.ts         Token-protected memory read/write endpoint
  audit.ts          Token-protected audit log endpoint
  metrics.ts        Token-protected health/latency history endpoint
services/
  security.ts       Token comparison, rate limiting, audit logging
  metrics.ts        Health snapshots and latency history
  ai.ts             Groq / OpenRouter fallback
  github.ts         GitHub App + REST integration
  memory.ts         Vercel KV memory storage
  sentry.ts         Error tracking
  telegram.ts       Telegram Bot API
  trello.ts         Trello integration
types/
  http.ts           Shared API request/response types
  memory.ts         Shared runtime memory type
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
SENTRY_TRACES_SAMPLE_RATE=0.1
DASHBOARD_TOKEN=
CRON_SECRET=
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

Legacy names `APP_ID`, `PRIVATE_KEY`, and `WEBHOOK_SECRET` are still accepted as fallbacks.

`DASHBOARD_TOKEN` protects every dashboard API request. The dashboard HTML can be opened without a token, but it prompts for the token and sends it only through the `x-dashboard-token` header. It is never accepted from the URL query string.

`TELEGRAM_WEBHOOK_SECRET` is required. Telegram webhook requests fail closed with `503` when it is missing, and with `401` when the secret is invalid.

`CRON_SECRET` protects `GET /api?cron=true` through `Authorization: Bearer <CRON_SECRET>`. The dashboard token is also accepted for manual runs.

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

Enter the value of `DASHBOARD_TOKEN` in the unlock dialog. The token is stored in `sessionStorage` and sent only through the `x-dashboard-token` header. It is never placed in the URL.

Dashboard capabilities:

- Sidebar control center with KPI cards and service status
- 24-hour availability strip and sparklines
- Command palette (`Ctrl+K`) with recent commands, keyboard history, and autocomplete
- Latency chart with 1h / 6h / 24h ranges
- Persistent memory search, quick-add, save, and one-step undo
- Protected audit trail with type/date/search filters, pagination, and CSV/JSON export
- Compact mode, skeleton loading, toast feedback, and responsive mobile navigation
- JSON log export

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api` | Telegram webhook, GitHub webhook, and dashboard commands |
| GET | `/api?health=true` | Service health (detailed data requires token) |
| GET | `/api?test=true` | Connectivity test (details require token) |
| GET | `/api?cron=true` | Security digest cron (`CRON_SECRET` or dashboard token) |
| GET | `/api/dashboard` | Dashboard HTML (token prompt; data APIs stay protected) |
| GET | `/api/memory` | Read runtime memory (token required) |
| POST | `/api/memory` | Save or clear runtime memory (token required) |
| GET | `/api/audit` | Read the recent audit trail (token required) |
| GET | `/api/metrics` | Read health and latency history (token required) |
| POST | `/api/metrics` | Record a latency sample (token required) |

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

- Dashboard data endpoints require `DASHBOARD_TOKEN` and fail closed if it is absent.
- The dashboard token is accepted only from the `x-dashboard-token` header, never from a query string.
- Memory writes require the `x-dashboard-token` header.
- Dashboard, Telegram, and cron requests are rate limited through Vercel KV.
- Rate limiting fails closed when KV is unavailable.
- Memory changes, approvals, merges, and dashboard commands are written to the `helios_audit_log_v2` KV list.
- GitHub webhooks are verified over the raw request body with `GITHUB_WEBHOOK_SECRET` (or `WEBHOOK_SECRET`), and delivery IDs are deduplicated.
- `TELEGRAM_WEBHOOK_SECRET` is required; Telegram webhook requests fail closed when it is missing.
- `approve:` and `mergepr:` callbacks require an admin, a HELIOS-NET repository, and sanitized task/file/PR values. Only open `helios-pilot/*` branches can be merged.
- Sentry scrubs authorization, cookie, dashboard, Telegram, and GitHub signature headers. Trace sampling defaults to `0.1`.
- The dashboard response includes a Content Security Policy and other hardening headers.

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

HeliosPilot بوت Telegram ولوحة تحكم Serverless لمراقبة GitHub وتحليل الكود وإدارة الذاكرة. تُقدَّم واجهة لوحة التحكم دون توكن، ثم تُطلب قيمة `DASHBOARD_TOKEN` وتُرسل عبر الهيدر فقط، بينما تبقى كل واجهات البيانات محمية. الذاكرة محفوظة في Vercel KV، و`TELEGRAM_WEBHOOK_SECRET` و`CRON_SECRET` إلزاميان لتشغيل Webhook وcron بأمان. شغّل `npm run check` و`npm test` قبل النشر.
