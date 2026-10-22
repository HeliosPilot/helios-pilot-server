# HeliosPilot - AI DevSecOps Companion

HeliosPilot is a serverless Telegram bot and dashboard for monitoring GitHub repositories, reviewing code, and assisting with DevSecOps workflows. It connects Telegram, GitHub webhooks, Vercel KV, Sentry, and AI providers (Groq / OpenRouter) in one deployment.

## Features

- GitHub Actions, issue, pull request, Dependabot, and code-scanning monitoring
- AI-powered code review, security analysis, and repository Q&A
- Persistent runtime memory backed by Vercel KV
- Admin-only Telegram memory commands (`/remember`, `/memory`, `/forget`)
- Protected dashboard with health checks, command runner, charts, and memory editor
- Telegram commands for status, metrics, wiki generation, and auto-fix workflows
- Weekly Codex Security scan through OpenRouter with SARIF upload
- Cross-repository HELIOS-NET security scanning through the existing GitHub App
- GitHub API emulator integration tests
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

## Technology Stack

| Layer | Used in HeliosPilot | Purpose |
| --- | --- | --- |
| Runtime | Node.js, TypeScript, Vercel Functions | Serverless API and webhooks |
| Telegram | Telegram Bot API | Commands, callbacks, and notifications |
| GitHub | GitHub App + [`@octokit/rest`](https://github.com/octokit/rest.js) | Webhooks, repositories, PRs, issues, and checks |
| Storage | Vercel KV | Runtime memory, rate limits, and audit log |
| AI | [`groq-sdk`](https://github.com/groq/groq-typescript) + OpenRouter | Primary model with automatic fallback |
| Observability | [`@sentry/node`](https://github.com/getsentry/sentry-javascript) | Error tracking and scrubbed traces |
| CI | GitHub Actions | Typecheck, tests, and action-pin verification |
| Security scanning | [`github/codeql-action`](https://github.com/github/codeql-action) | JavaScript/TypeScript CodeQL analysis |
| AI security scanning | [`openai/codex-security`](https://github.com/openai/codex-security) + OpenRouter | Weekly report-only scan with SARIF upload |
| Cross-repo scanning | GitHub App installation token + `codex-security` CLI | Scans `Ismail-Benali/HELIOS-NET` from HeliosPilot Actions |
| Integration testing | [`emulate`](https://github.com/vercel-labs/emulate) | Stateful GitHub App and REST API tests |
| Dependency updates | GitHub Dependabot | Weekly npm and GitHub Actions updates |
| Supply chain | SHA-pinned Actions + `scripts/check-action-pins.mjs` | Blocks unpinned external Actions in CI |

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

Codex Security automation does not need runtime environment variables. It uses the repository secret `OPENROUTER_API_KEY` and the repository variable `CODEX_SECURITY_MODEL` (for example `anthropic/claude-sonnet-4.5`). If either is missing, the workflow skips with a warning instead of failing.

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
| `/remember <text>` | Save a permanent memory entry (admin only) |
| `/memory` | Show the latest permanent memory entries (admin only) |
| `/forget <index\|all>` | Remove one memory entry or clear all (admin only) |
| `repos` | List connected repositories |

## HELIOS-NET Cross-Repository Scanning

The `HELIOS-NET Security` workflow runs weekly and on demand from `helios-pilot-server`. It does not add files to HELIOS-NET and does not use a personal access token.

How it works:

1. Creates a short-lived GitHub App installation token for `Ismail-Benali/HELIOS-NET`.
2. Checks out HELIOS-NET into a separate `target/` directory.
3. Runs the pinned Codex Security CLI (`0.6.0`) with `provider: openrouter`, `effort: medium`, and a 15-minute investigation allowance.
4. Uploads SARIF to HELIOS-NET code scanning when the GitHub App has `security-events: write`.
5. Creates or updates one open issue in HELIOS-NET with the summary and top findings.
6. HeliosPilot receives the `issues` webhook and sends the Telegram notification.

Required GitHub Actions configuration in `helios-pilot-server`:

- Secrets: `HELIOS_APP_ID`, `HELIOS_APP_PRIVATE_KEY`, `OPENROUTER_API_KEY`
- Variable: `CODEX_SECURITY_MODEL` (recommended: `anthropic/claude-sonnet-4.5`)

GitHub does not allow Actions secret names beginning with `GITHUB_`, so the workflow maps `HELIOS_APP_ID` and `HELIOS_APP_PRIVATE_KEY` to the `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` environment variables expected by the application.

```bash
gh secret set HELIOS_APP_ID --body 5317568
gh secret set HELIOS_APP_PRIVATE_KEY < app-private-key.pem
gh secret set OPENROUTER_API_KEY --body "$OPENROUTER_API_KEY"
```

Required GitHub App permissions on HELIOS-NET:

- `contents: read` for checkout
- `issues: write` for the report issue
- `security-events: write` for SARIF upload (optional; the workflow continues without it)

The workflow skips with a warning when configuration is missing, so it never runs with empty credentials.

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
- CodeQL runs on pushes, pull requests, and a weekly schedule with the `security-extended` query suite.
- All GitHub Actions are pinned to full commit SHAs, and CI rejects unpinned actions through `npm run check:actions`.
- Codex Security runs weekly and on demand through OpenRouter, is report-only (`fail-on-severity: none`), and uploads SARIF when the scan completes.
- The HELIOS-NET workflow uses a short-lived GitHub App installation token, never a stored PAT, and runs with a 15-minute investigation allowance.
- `/remember`, `/memory`, and `/forget` require an admin, are rate limited to 10 requests per minute, and write to the audit log.
- Dependabot checks npm dependencies and pinned GitHub Actions weekly.
- GitHub integration tests run against a local `emulate` server on Node 24, without real GitHub credentials or network access.

## Testing

```bash
npm run check
npm run check:actions
npm test
npm run test:integration
```

`npm test` runs the unit and API tests on Node 20. `npm run test:integration` requires Node 24 and runs the GitHub App, issue, comment, and RAG tests against `emulate`.

CI runs these checks on every push and pull request to `main`.

## Production Checklist

1. Confirm `DASHBOARD_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, GitHub App credentials, and Vercel KV are set in Vercel Production.
2. Set `SENTRY_DSN` if error tracking is required; `/api?health=true` reports `sentry:false` until it is configured.
3. Add the `HELIOS_APP_ID`, `HELIOS_APP_PRIVATE_KEY`, and `OPENROUTER_API_KEY` repository secrets and the `CODEX_SECURITY_MODEL` repository variable, then run `HELIOS-NET Security` once manually.
4. Confirm the GitHub App is installed on HELIOS-NET with `contents: read`, `issues: write`, and `security-events: write`.
5. Verify the deployment with `GET /api?health=true`, `GET /api?test=true`, and `GET /api/memory` using the `x-dashboard-token` header.
6. Confirm the Telegram webhook is registered with the same `TELEGRAM_WEBHOOK_SECRET` and that `/start`, `/status`, `/remember`, `/memory`, and `/forget` respond.

## License

MIT. See [LICENSE](LICENSE).

---

## نظرة سريعة بالعربية

HeliosPilot بوت Telegram ولوحة تحكم Serverless لمراقبة GitHub وتحليل الكود وإدارة الذاكرة. تُقدَّم واجهة لوحة التحكم دون توكن، ثم تُطلب قيمة `DASHBOARD_TOKEN` وتُرسل عبر الهيدر فقط، بينما تبقى كل واجهات البيانات محمية. الذاكرة محفوظة في Vercel KV، و`TELEGRAM_WEBHOOK_SECRET` و`CRON_SECRET` إلزاميان لتشغيل Webhook وcron بأمان. أضيفت أوامر ذاكرة للمشرف فقط: `/remember` و`/memory` و`/forget` مع rate limit وسجل تدقيق. قسم **Technology Stack** يوثّق التقنيات والمكتبات المستخدمة، ويشمل CI فحص TypeScript والاختبارات وCodeQL والتحقق من تثبيت GitHub Actions، مع تحديثات Dependabot الأسبوعية. يفحص workflow **HELIOS-NET Security** مستودع `Ismail-Benali/HELIOS-NET` أسبوعيًا من داخل HeliosPilot باستخدام GitHub App installation token، ثم يرفع SARIF وينشئ Issue وتصل الإشعارات إلى Telegram عبر webhook. يضاف فحص Codex Security أسبوعيًا عبر OpenRouter ويرفع SARIF عند اكتمال الفحص، وتعمل اختبارات تكامل GitHub عبر `emulate` على Node 24. شغّل `npm run check` و`npm run check:actions` و`npm test` و`npm run test:integration` قبل النشر.
