import crypto from 'node:crypto';
import { kv } from './kv';

const MAX_AUDIT_ENTRIES = 200;

export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''));
  const rightBuffer = Buffer.from(String(right ?? ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function getDashboardToken(req) {
  return req.headers?.['x-dashboard-token'] || req.query?.token || '';
}

export function isDashboardConfigured() {
  return Boolean(process.env.DASHBOARD_TOKEN);
}

export function isDashboardAuthorized(req) {
  const configuredToken = process.env.DASHBOARD_TOKEN;
  if (!configuredToken) return false;
  return safeEqual(getDashboardToken(req), configuredToken);
}

export async function enforceRateLimit(req, bucket, limit = 60, windowSeconds = 60) {
  const key = `rate_limit_${bucket}_${getClientIp(req)}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSeconds);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (error) {
    console.error('Rate limit store unavailable:', error.message);
    return { allowed: true, remaining: limit };
  }
}

export async function auditEvent(event, details = {}, req = null) {
  const entry = {
    time: new Date().toISOString(),
    event,
    ip: req ? getClientIp(req) : null,
    userAgent: req?.headers?.['user-agent'] || null,
    ...details
  };

  try {
    const current = (await kv.get('helios_audit_log')) || [];
    const next = Array.isArray(current) ? current : [];
    next.push(entry);
    await kv.set('helios_audit_log', next.slice(-MAX_AUDIT_ENTRIES));
  } catch (error) {
    console.error('Audit log store unavailable:', error.message);
  }

  return entry;
}

export function rateLimitResponse(res, retryAfterSeconds = 60) {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({ success: false, error: 'Too many requests' });
}
