import fs from 'fs';
import path from 'path';
import {
  enforceRateLimit,
  isDashboardAuthorized,
  isDashboardConfigured,
  rateLimitResponse
} from '../services/security';

export default async function handler(req, res) {
  if (!isDashboardConfigured()) {
    return res.status(503).send('Dashboard disabled: DASHBOARD_TOKEN is not configured');
  }

  if (!isDashboardAuthorized(req)) {
    return res.status(401).send('Unauthorized');
  }

  const rate = await enforceRateLimit(req, 'dashboard', 120, 60);
  if (!rate.allowed) return rateLimitResponse(res, 60);

  try {
    const filePath = path.join(process.cwd(), 'views', 'dashboard.html');
    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.status(200).send(html);
  } catch {
    return res.status(500).send('Dashboard unavailable');
  }
}
