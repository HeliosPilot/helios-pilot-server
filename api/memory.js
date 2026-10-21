import { getRuntimeMemory, saveRuntimeMemory } from '../services/memory.js';

const MAX_ENTRIES = 25;
const MAX_ENTRY_LENGTH = 2000;

function isAuthorized(req) {
  const configuredToken = process.env.DASHBOARD_TOKEN;
  if (!configuredToken) return true;

  const providedToken = req.query?.token || req.headers?.['x-dashboard-token'];
  return providedToken === configuredToken;
}

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

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return null;

  return entries
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, MAX_ENTRY_LENGTH))
    .slice(-MAX_ENTRIES);
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const memory = await getRuntimeMemory();
      return res.status(200).json({ success: true, memory: publicMemory(memory) });
    } catch {
      return res.status(500).json({ success: false, error: 'Unable to load memory' });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req.body);

    if (body.clear === true) {
      try {
        const memory = await getRuntimeMemory();
        memory.dynamicMemory = [];
        await saveRuntimeMemory(memory);
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
      await saveRuntimeMemory(memory);
      return res.status(200).json({ success: true, memory: publicMemory(memory) });
    } catch {
      return res.status(500).json({ success: false, error: 'Unable to save memory' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
