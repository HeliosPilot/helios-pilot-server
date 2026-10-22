import { kv } from './kv.js';

const HEALTH_KEY = 'helios_health_history';
const LATENCY_KEY = 'helios_latency_history';
const MAX_ENTRIES = 288;
const BUCKET_MS = 5 * 60 * 1000;

export function bucketStart(value = Date.now()) {
  return Math.floor(value / BUCKET_MS) * BUCKET_MS;
}

export function normalizeLatency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(Math.round(parsed), 60000);
}

export function summarizeHealth(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    return { samples: 0, uptime: null, servicesOnline: null, servicesTotal: null };
  }

  let healthy = 0;
  let online = 0;
  let total = 0;

  for (const entry of list) {
    if (entry?.status === 'healthy') healthy += 1;
    const services = entry?.services || {};
    const values = Object.values(services);
    if (values.length) {
      online += values.filter(Boolean).length;
      total += values.length;
    }
  }

  return {
    samples: list.length,
    uptime: Math.round((healthy / list.length) * 100),
    servicesOnline: total ? online : null,
    servicesTotal: total || null
  };
}

async function upsertBucket(key, entry) {
  try {
    const current = await kv.get(key);
    const list = Array.isArray(current) ? current.filter((item) => item?.time) : [];
    const last = list[list.length - 1];

    if (last && new Date(last.time).getTime() === new Date(entry.time).getTime()) {
      list[list.length - 1] = entry;
    } else {
      list.push(entry);
    }

    await kv.set(key, list.slice(-MAX_ENTRIES));
    return true;
  } catch {
    return false;
  }
}

export async function recordHealthSnapshot(snapshot) {
  const time = new Date(bucketStart()).toISOString();
  return upsertBucket(HEALTH_KEY, { time, ...snapshot });
}

export async function recordLatency(value) {
  const latency = normalizeLatency(value);
  if (latency === null) return false;
  const time = new Date(bucketStart()).toISOString();
  return upsertBucket(LATENCY_KEY, { time, latency });
}

export async function getMetrics() {
  try {
    const [health, latency] = await Promise.all([
      kv.get(HEALTH_KEY),
      kv.get(LATENCY_KEY)
    ]);

    const history = Array.isArray(health) ? health : [];
    const latencyHistory = Array.isArray(latency) ? latency : [];

    return {
      history,
      latency: latencyHistory,
      summary: summarizeHealth(history)
    };
  } catch {
    return {
      history: [],
      latency: [],
      summary: { samples: 0, uptime: null, servicesOnline: null, servicesTotal: null }
    };
  }
}
