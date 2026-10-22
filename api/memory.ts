import { getRuntimeMemory, saveRuntimeMemory } from '../services/memory';
import {
  auditEvent,
  enforceRateLimit,
  isDashboardAuthorized,
  isDashboardConfigured,
  rateLimitResponse,
  safeEqual
} from '../services/security';

const MAX_ENTRIES = 25;
const MAX_ENTRY_LENGTH = 2000;

function publicMemory(memory) {
  return {
    creator: memory.creator,
    targetProject: memory.targetProject,
    dynamicMemory: Array.isArray(memory.dynamicMemory) ? memory.dynamicMemory : [],
    lastContextUrl: memory.lastContextUrl || null,
    userActiveRepos: memory.userActiveRepos || {},
    updatedAt: new Date().toISOString()
  };
}

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

export function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return null;

  return entries
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, MAX_ENTRY_LENGTH))
    .slice(-MAX_ENTRIES);
}

function hasHeaderToken(req) {
  const configuredToken = process.env.DASHBOARD_TOKEN;
  if (!configuredToken) return false;
  return safeEqual(req.headers?.['x-dashboard-token'], configuredToken);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (!isDashboardConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Dashboard disabled: DASHBOARD_TOKEN is not configured'
    });
  }

  if (!isDashboardAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const rate = await enforceRateLimit(req, 'memory', 60, 60);
  if (!rate.allowed) return rateLimitResponse(res, 60);

  if (req.method === 'GET') {
    try {
      const memory = await getRuntimeMemory();
      return res.status(200).json({ success: true, memory: publicMemory(memory) });
    } catch {
      return res.status(500).json({ success: false, error: 'Unable to load memory' });
    }
  }

  if (req.method === 'POST') {
    if (!hasHeaderToken(req)) {
      return res.status(401).json({ success: false, error: 'Missing dashboard token header' });
    }

    const body = parseBody(req.body);

    if (body.clear === true) {
      try {
        const memory = await getRuntimeMemory();
        memory.dynamicMemory = [];
        const saved = await saveRuntimeMemory(memory);
        if (!saved) throw new Error('KV write failed');
        await auditEvent('memory_clear', { source: 'dashboard' }, req);
        return res.status(200).json({ success: true, memory: publicMemory(memory) });
      } catch {
        return res.status(500).json({ success: false, error: 'Unable to clear memory' });
      }
    }

    const entries = normalizeEntries(body.dynamicMemory);
    if (!entries) {
      return res.status(400).json({ success: false, error: 'dynamicMemory must be an array' });
    }

    try {
      const memory = await getRuntimeMemory();
      memory.dynamicMemory = entries;
      const saved = await saveRuntimeMemory(memory);
      if (!saved) throw new Error('KV write failed');
      await auditEvent('memory_save', { source: 'dashboard', entries: entries.length }, req);
      return res.status(200).json({ success: true, memory: publicMemory(memory) });
    } catch {
      return res.status(500).json({ success: false, error: 'Unable to save memory' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

export { publicMemory };
