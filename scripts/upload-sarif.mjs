import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Octokit } from '@octokit/rest';

const token = process.env.TARGET_TOKEN;
const owner = process.env.TARGET_OWNER;
const repo = process.env.TARGET_REPO;
const scanDir = process.env.SCAN_DIR;
const commitSha = process.env.TARGET_SHA;
const ref = process.env.TARGET_REF || 'refs/heads/master';
const category = process.env.SARIF_CATEGORY || 'codex-security-helios-net';

if (!token || !owner || !repo || !scanDir || !commitSha) {
  throw new Error('TARGET_TOKEN, TARGET_OWNER, TARGET_REPO, SCAN_DIR, and TARGET_SHA are required.');
}

function findFile(directory, fileName) {
  if (!fs.existsSync(directory)) return null;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(entryPath, fileName);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }
  }
  return null;
}

const sarifPath = findFile(scanDir, 'results.sarif');
if (!sarifPath) {
  console.log('::warning::Codex Security did not produce results.sarif; skipping SARIF upload.');
  process.exit(0);
}

const sarif = JSON.parse(fs.readFileSync(sarifPath, 'utf8'));
for (const run of sarif.runs || []) {
  run.automationDetails = { ...(run.automationDetails || {}), id: category };
}

const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(sarif))).toString('base64');
const octokit = new Octokit({ auth: token });

try {
  const response = await octokit.request('POST /repos/{owner}/{repo}/code-scanning/sarifs', {
    owner,
    repo,
    commit_sha: commitSha,
    ref,
    sarif: compressed,
    tool_name: 'Codex Security',
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  console.log(`Uploaded SARIF to ${owner}/${repo}: ${response.data.url || response.data.id || 'accepted'}`);
} catch (error) {
  console.log(`::warning::SARIF upload to ${owner}/${repo} failed: ${error.message}`);
}
