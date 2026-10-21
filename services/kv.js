import { createClient, kv as vercelKv } from '@vercel/kv';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const kv = url && token ? createClient({ url, token }) : vercelKv;
