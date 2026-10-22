import { test } from 'node:test';
import assert from 'node:assert';
import {
  appendMemoryEntry,
  formatMemoryEntries,
  parseMemoryCommandArgument,
  removeMemoryEntry
} from '../api/index';

test('appendMemoryEntry trims text and keeps the newest entries', () => {
  const entries = appendMemoryEntry(['old-1', 'old-2'], '  new entry  ', 2);

  assert.deepStrictEqual(entries, ['old-2', 'new entry']);
});

test('appendMemoryEntry caps entry length', () => {
  const entries = appendMemoryEntry([], 'x'.repeat(2500), 25, 2000);

  assert.strictEqual(entries[0].length, 2000);
});

test('removeMemoryEntry removes by one-based index', () => {
  assert.deepStrictEqual(removeMemoryEntry(['a', 'b', 'c'], '2'), ['a', 'c']);
});

test('removeMemoryEntry supports clearing all entries', () => {
  assert.deepStrictEqual(removeMemoryEntry(['a', 'b'], 'all'), []);
});

test('removeMemoryEntry rejects invalid indexes', () => {
  assert.strictEqual(removeMemoryEntry(['a'], '0'), null);
  assert.strictEqual(removeMemoryEntry(['a'], '2'), null);
  assert.strictEqual(removeMemoryEntry(['a'], 'nope'), null);
});

test('formatMemoryEntries numbers the latest entries', () => {
  const formatted = formatMemoryEntries(['first', 'second', 'third'], 2);

  assert.strictEqual(formatted, '2. second\n3. third');
});

test('parseMemoryCommandArgument strips the command and bot mention', () => {
  assert.strictEqual(
    parseMemoryCommandArgument('/remember@HeliosPilot_bot حفظ هذا التوجيه', 'remember'),
    'حفظ هذا التوجيه'
  );
});
