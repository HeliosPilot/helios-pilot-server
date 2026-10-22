import crypto from 'node:crypto';
import { kv } from './kv';

const MAX_AUDIT_ENTRIES = 200;
const AUDIT_LIST_KEY = 'helios_audit_log_v2';
const AUDIT_LEGACY_KEY = 'helios_audit_log';

export function getClientIp(req) {
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

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
  return req.headers?.['x-dashboard-token'] || '';
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
    return { allowed: false, remaining: 0 };
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
    await kv.lpush(AUDIT_LIST_KEY, JSON.stringify(entry));
    await kv.ltrim(AUDIT_LIST_KEY, 0, MAX_AUDIT_ENTRIES - 1);
  } catch (error) {
    console.error('Audit log store unavailable:', error.message);
  }

  return entry;
}

export async function getAuditEvents(limit = 50) {
  try {
    const stored = (await kv.lrange(AUDIT_LIST_KEY, 0, Math.max(0, limit - 1))) as unknown[];
    if (Array.isArray(stored) && stored.length > 0) {
      return stored
        .map((entry) => {
          if (typeof entry !== 'string') return entry;
          try {
            return JSON.parse(entry);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }

    const legacy = await kv.get(AUDIT_LEGACY_KEY);
    return Array.isArray(legacy) ? legacy.slice(-limit).reverse() : [];
  } catch (error) {
    console.error('Audit log read failed:', error.message);
    return [];
  }
}

export function rateLimitResponse(res, retryAfterSeconds = 60) {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({ success: false, error: 'Too many requests' });
}
