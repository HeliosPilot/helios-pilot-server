import fs from 'fs';
import path from 'path';
import { enforceRateLimit, rateLimitResponse } from '../services/security';

export default async function handler(req, res) {
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
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'"
    );
    return res.status(200).send(html);
  } catch {
    return res.status(500).send('Dashboard unavailable');
  }
}
