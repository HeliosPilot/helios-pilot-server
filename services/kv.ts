import { createClient, kv as vercelKv } from '@vercel/kv';

function clean(value) {
  return String(value || '').trim().replace(/^["']/, '').replace(/["']$/, '');
}

const url = clean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
const token = clean(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);

export const kv = url && token ? createClient({ url, token }) : vercelKv;
