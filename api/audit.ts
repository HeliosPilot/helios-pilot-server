import { kv } from '../services/kv';
import {
  enforceRateLimit,
  isDashboardAuthorized,
  isDashboardConfigured,
  rateLimitResponse
} from '../services/security';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (!isDashboardConfigured()) {
    return res.status(503).json({ success: false, error: 'Dashboard disabled' });
  }

  if (!isDashboardAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const rate = await enforceRateLimit(req, 'audit', 60, 60);
  if (!rate.allowed) return rateLimitResponse(res, 60);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const stored = await kv.get('helios_audit_log');
    const events = Array.isArray(stored) ? stored.slice(-50).reverse() : [];
    return res.status(200).json({ success: true, events });
  } catch {
    return res.status(500).json({ success: false, error: 'Unable to load audit log' });
  }
}
