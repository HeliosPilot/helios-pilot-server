import { test } from 'node:test';
import assert from 'node:assert';
import { isAdmin } from '../api/index';

test('isAdmin returns true for main admin', () => {
    process.env.TELEGRAM_CHAT_ID = '12345';
    const memory = { admins: [] };
    assert.strictEqual(isAdmin('12345', memory), true);
});

test('isAdmin returns true for added admin', () => {
    const memory = { admins: ['67890'] };
    assert.strictEqual(isAdmin('67890', memory), true);
});

test('isAdmin returns false for unauthorized user', () => {
    process.env.TELEGRAM_CHAT_ID = '12345';
    const memory = { admins: [] };
    assert.strictEqual(isAdmin('99999', memory), false);
});

test('isAdmin fails closed when the chat id is missing', () => {
    process.env.TELEGRAM_CHAT_ID = '12345';
    assert.strictEqual(isAdmin(undefined, { admins: [] }), false);
});
