import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeEntries } from '../api/memory.js';

test('normalizeEntries rejects non-arrays', () => {
  assert.strictEqual(normalizeEntries('not-an-array'), null);
  assert.strictEqual(normalizeEntries(null), null);
});

test('normalizeEntries trims, removes blanks, and keeps the newest 25 entries', () => {
  const input = Array.from({ length: 30 }, (_, index) => `  entry-${index}  `);
  input.push('   ');

  const normalized = normalizeEntries(input);

  assert.strictEqual(normalized.length, 25);
  assert.strictEqual(normalized[0], 'entry-5');
  assert.strictEqual(normalized[24], 'entry-29');
});

test('normalizeEntries caps each entry at 2000 characters', () => {
  const normalized = normalizeEntries(['x'.repeat(2500)]);

  assert.strictEqual(normalized[0].length, 2000);
});
