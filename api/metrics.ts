import {
  enforceRateLimit,
  isDashboardAuthorized,
  isDashboardConfigured,
  rateLimitResponse
} from '../services/security';
import { getMetrics, normalizeLatency, recordLatency } from '../services/metrics';

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

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

  const rate = await enforceRateLimit(req, 'metrics', 90, 60);
  if (!rate.allowed) return rateLimitResponse(res, 60);

  if (req.method === 'GET') {
    const metrics = await getMetrics();
    return res.status(200).json({ success: true, ...metrics });
  }

  if (req.method === 'POST') {
    const body = parseBody(req.body);
    const latency = normalizeLatency(body.latency);
    if (latency === null) {
      return res.status(400).json({ success: false, error: 'latency must be a non-negative number' });
    }

    const saved = await recordLatency(latency);
    if (!saved) {
      return res.status(500).json({ success: false, error: 'Unable to record latency' });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
