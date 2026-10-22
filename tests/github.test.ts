import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { verifyGitHubSignature } from '../services/github';

function signatureFor(secret, body) {
  return `sha256=${crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex')}`;
}

function signatureForRaw(secret, body) {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

function withSecret(secret, callback) {
  const previousGithub = process.env.GITHUB_WEBHOOK_SECRET;
  const previous = process.env.WEBHOOK_SECRET;
  delete process.env.GITHUB_WEBHOOK_SECRET;
  if (secret === undefined) {
    delete process.env.WEBHOOK_SECRET;
  } else {
    process.env.WEBHOOK_SECRET = secret;
  }

  try {
    callback();
  } finally {
    if (previousGithub === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = previousGithub;
    if (previous === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = previous;
  }
}

test('GitHub signature verification fails closed without a secret', () => {
  withSecret(undefined, () => {
    assert.strictEqual(verifyGitHubSignature({ headers: {}, body: {} }), false);
  });
});

test('GitHub signature verification accepts a valid signature', () => {
  withSecret('webhook-secret', () => {
    const body = { action: 'opened' };
    assert.strictEqual(
      verifyGitHubSignature({
        headers: { 'x-hub-signature-256': signatureFor('webhook-secret', body) },
        body
      }),
      true
    );
  });
});

test('GitHub signature verification rejects an invalid signature', () => {
  withSecret('webhook-secret', () => {
    assert.strictEqual(
      verifyGitHubSignature({
        headers: { 'x-hub-signature-256': 'sha256=invalid' },
        body: { action: 'opened' }
      }),
      false
    );
  });
});

test('GitHub signature verification uses the raw request body', () => {
  withSecret('webhook-secret', () => {
    const rawBody = '{"action":"opened","number":1}';
    assert.strictEqual(
      verifyGitHubSignature(
        { headers: { 'x-hub-signature-256': signatureForRaw('webhook-secret', rawBody) } },
        rawBody
      ),
      true
    );
  });
});
