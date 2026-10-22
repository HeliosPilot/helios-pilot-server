import { test } from 'node:test';
import assert from 'node:assert';
import { bucketStart, normalizeLatency, summarizeHealth } from '../services/metrics.js';

test('bucketStart aligns timestamps to five-minute buckets', () => {
  const start = bucketStart(Date.UTC(2026, 0, 1, 12, 7, 42));
  assert.strictEqual(new Date(start).toISOString(), '2026-01-01T12:05:00.000Z');
});

test('normalizeLatency rejects invalid values and caps large ones', () => {
  assert.strictEqual(normalizeLatency(-1), null);
  assert.strictEqual(normalizeLatency('not-a-number'), null);
  assert.strictEqual(normalizeLatency(123.6), 124);
  assert.strictEqual(normalizeLatency(999999), 60000);
});

test('summarizeHealth calculates uptime and service totals', () => {
  const summary = summarizeHealth([
    { status: 'healthy', services: { telegram: true, github: true, ai: true, kv: true } },
    { status: 'degraded', services: { telegram: true, github: false, ai: true, kv: true } }
  ]);

  assert.strictEqual(summary.samples, 2);
  assert.strictEqual(summary.uptime, 50);
  assert.strictEqual(summary.servicesOnline, 7);
  assert.strictEqual(summary.servicesTotal, 8);
});

test('summarizeHealth handles empty history', () => {
  assert.deepStrictEqual(summarizeHealth([]), {
    samples: 0,
    uptime: null,
    servicesOnline: null,
    servicesTotal: null
  });
});
