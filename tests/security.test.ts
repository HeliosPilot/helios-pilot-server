import { test } from 'node:test';
import assert from 'node:assert';
import {
  getClientIp,
  isDashboardAuthorized,
  isDashboardConfigured,
  safeEqual
} from '../services/security';

function withToken(token, callback) {
  const previous = process.env.DASHBOARD_TOKEN;
  if (token === undefined) {
    delete process.env.DASHBOARD_TOKEN;
  } else {
    process.env.DASHBOARD_TOKEN = token;
  }

  try {
    callback();
  } finally {
    if (previous === undefined) {
      delete process.env.DASHBOARD_TOKEN;
    } else {
      process.env.DASHBOARD_TOKEN = previous;
    }
  }
}

test('dashboard auth fails closed when DASHBOARD_TOKEN is missing', () => {
  withToken(undefined, () => {
    assert.strictEqual(isDashboardConfigured(), false);
    assert.strictEqual(isDashboardAuthorized({ headers: { 'x-dashboard-token': 'anything' } }), false);
  });
});

test('dashboard auth accepts the configured header token', () => {
  withToken('secret-token', () => {
    assert.strictEqual(isDashboardAuthorized({ headers: { 'x-dashboard-token': 'secret-token' } }), true);
  });
});

test('dashboard auth accepts the configured query token', () => {
  withToken('secret-token', () => {
    assert.strictEqual(isDashboardAuthorized({ headers: {}, query: { token: 'secret-token' } }), true);
  });
});

test('dashboard auth rejects an invalid token', () => {
  withToken('secret-token', () => {
    assert.strictEqual(isDashboardAuthorized({ headers: { 'x-dashboard-token': 'wrong' } }), false);
  });
});

test('safeEqual compares values without length leaks', () => {
  assert.strictEqual(safeEqual('same', 'same'), true);
  assert.strictEqual(safeEqual('same', 'diff'), false);
  assert.strictEqual(safeEqual('short', 'longer'), false);
});

test('getClientIp reads the first forwarded address', () => {
  assert.strictEqual(getClientIp({ headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' } }), '203.0.113.1');
});
