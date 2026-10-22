import crypto from 'node:crypto';
import fs from 'node:fs';

const appId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');
const owner = process.env.TARGET_OWNER;
const repo = process.env.TARGET_REPO;
const apiUrl = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');

if (!appId || !privateKey || !owner || !repo) {
  throw new Error('GITHUB_APP_ID, GITHUB_PRIVATE_KEY, TARGET_OWNER, and TARGET_REPO are required.');
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

const now = Math.floor(Date.now() / 1000);
const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
const unsigned = `${header}.${payload}`;
const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url');
const jwt = `${unsigned}.${signature}`;

const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${jwt}`,
  'user-agent': 'helios-pilot-security',
  'x-github-api-version': '2022-11-28'
};

const installationsResponse = await fetch(`${apiUrl}/app/installations`, { headers });
if (!installationsResponse.ok) {
  throw new Error(`Unable to list GitHub App installations: ${installationsResponse.status} ${await installationsResponse.text()}`);
}

const installations = await installationsResponse.json();
const installation = installations.find(
  (entry) => entry.account?.login?.toLowerCase() === owner.toLowerCase()
);

if (!installation) {
  throw new Error(`GitHub App is not installed on ${owner}.`);
}

const tokenResponse = await fetch(`${apiUrl}/app/installations/${installation.id}/access_tokens`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ repositories: [repo] })
});

if (!tokenResponse.ok) {
  throw new Error(`Unable to create installation token: ${tokenResponse.status} ${await tokenResponse.text()}`);
}

const tokenData = await tokenResponse.json();
const token = tokenData.token;

if (!token) {
  throw new Error('GitHub App installation token is missing from the response.');
}

console.log(`::add-mask::${token}`);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `token=${token}\ninstallation_id=${installation.id}\n`);
}
console.log(`Created installation token for ${owner}/${repo}.`);
