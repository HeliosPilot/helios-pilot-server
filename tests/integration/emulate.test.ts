import { after, before, test } from 'node:test';
import assert from 'node:assert';
import { Octokit } from '@octokit/rest';
import { createEmulator } from 'emulate';
import {
  addCommentToIssueOrPR,
  fetchCodebaseContextForRAG,
  getInstallationOctokitForRepo,
  parseAndFetchGitHubUrl
} from '../../services/github';

const APP_ID = 12345;
const ISSUE_URL = 'https://github.com/octocat/hello-world/issues/1';

let github;

before(async () => {
  github = await createEmulator({
    service: 'github',
    port: 0,
    seed: {
      github: {
        users: [{ login: 'octocat', name: 'The Octocat' }],
        repos: [
          {
            owner: 'octocat',
            name: 'hello-world',
            language: 'JavaScript',
            auto_init: true
          }
        ],
        apps: [
          {
            app_id: APP_ID,
            slug: 'helios-pilot',
            name: 'HeliosPilot',
            permissions: {
              contents: 'write',
              issues: 'write',
              pull_requests: 'write',
              metadata: 'read'
            },
            events: ['push', 'issues', 'pull_request'],
            installations: [{ installation_id: 100, account: 'octocat' }]
          }
        ],
        tokens: {
          'test-token': { login: 'octocat', scopes: ['repo'] }
        }
      }
    } as any
  });

  const privateKey = github.generatedSecrets.find(
    (secret) => secret.kind === 'github.app_private_key' && secret.id === String(APP_ID)
  )?.value;

  assert.ok(privateKey, 'emulate should generate a GitHub App private key');

  process.env.GITHUB_API_BASE_URL = github.url;
  process.env.GITHUB_APP_ID = String(APP_ID);
  process.env.GITHUB_PRIVATE_KEY = privateKey;

  const octokit = new Octokit({ auth: 'test-token', baseUrl: github.url });
  await octokit.issues.create({
    owner: 'octocat',
    repo: 'hello-world',
    title: 'Seeded security issue',
    body: 'Track the fix for the emulated integration test.'
  });
});

after(async () => {
  delete process.env.GITHUB_API_BASE_URL;
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_PRIVATE_KEY;
  if (github) await github.close();
});

test('resolves an installation token through the emulated GitHub App', async () => {
  const octokit = await getInstallationOctokitForRepo('octocat', 'hello-world');
  assert.ok(octokit, 'expected an installation Octokit instance');

  const { data } = await octokit.repos.get({ owner: 'octocat', repo: 'hello-world' });
  assert.strictEqual(data.full_name, 'octocat/hello-world');
});

test('reads an issue through the emulated GitHub API', async () => {
  const result = await parseAndFetchGitHubUrl(ISSUE_URL);

  assert.match(result, /Issue #1/);
  assert.match(result, /Seeded security issue/);
});

test('posts a comment through the emulated GitHub App', async () => {
  const result = await addCommentToIssueOrPR(ISSUE_URL, 'Automated review comment');
  assert.match(result, /#1/);

  const octokit = new Octokit({ auth: 'test-token', baseUrl: github.url });
  const { data } = await octokit.issues.listComments({
    owner: 'octocat',
    repo: 'hello-world',
    issue_number: 1
  });

  assert.ok(data.some((comment) => comment.body === 'Automated review comment'));
});

test('builds repository context for RAG from the emulated repo', async () => {
  const context = await fetchCodebaseContextForRAG('octocat', 'hello-world');

  assert.match(context, /Repository Context for HELIOS-NET/);
  assert.match(context, /Root Files:/);
});
