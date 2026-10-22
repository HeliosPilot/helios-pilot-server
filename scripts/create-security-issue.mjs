import fs from 'node:fs';
import path from 'node:path';
import { Octokit } from '@octokit/rest';

const token = process.env.TARGET_TOKEN;
const owner = process.env.TARGET_OWNER;
const repo = process.env.TARGET_REPO;
const scanDir = process.env.SCAN_DIR;
const scanOutcome = process.env.SCAN_OUTCOME || 'unknown';
const runUrl = process.env.RUN_URL || '';
const commitSha = process.env.TARGET_SHA || '';
const ref = process.env.TARGET_REF || 'refs/heads/master';
const resultPath = process.env.SCAN_RESULT;
const issueTitle = 'Codex Security: HELIOS-NET scan report';

if (!token || !owner || !repo) {
  throw new Error('TARGET_TOKEN, TARGET_OWNER, and TARGET_REPO are required.');
}

function findFile(directory, fileName) {
  if (!directory || !fs.existsSync(directory)) return null;
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

function readText(filePath, limit = 50000) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').slice(0, limit);
}

const findingsPath = findFile(scanDir, 'findings.json');
const reportPath = findFile(scanDir, 'report.md');

let findings = [];
let findingsParsed = false;
if (findingsPath) {
  try {
    const document = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
    findings = Array.isArray(document.findings) ? document.findings : [];
    findingsParsed = true;
  } catch {
    findings = [];
  }
}

const counts = {};
for (const finding of findings) {
  const severity = String(
    finding.severity || finding.level || finding.risk || finding.priority || 'unknown'
  ).toLowerCase();
  counts[severity] = (counts[severity] || 0) + 1;
}

function findingLine(finding) {
  const severity = String(
    finding.severity || finding.level || finding.risk || finding.priority || 'unknown'
  ).toLowerCase();
  const title = String(
    finding.title || finding.name || finding.message || finding.ruleId || finding.rule_id || 'Security finding'
  ).slice(0, 220);
  const location = finding.location || {};
  const file = String(
    location.path || finding.file || finding.path || finding.codeEvidence?.file || 'unknown'
  );
  const line = location.startLine || location.line || finding.line || finding.codeEvidence?.startLine;
  return `- **${severity}** ${title} (\`${file}${line ? `:${line}` : ''}\`)`;
}

const severitySummary = Object.entries(counts)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([severity, count]) => `${severity}: ${count}`)
  .join(', ') || 'none';

let cliError = '';
if (resultPath && fs.existsSync(resultPath)) {
  try {
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    cliError = String(result.message || result.error || result.code || '').slice(0, 2000);
  } catch {
    cliError = '';
  }
}

const report = readText(reportPath, 40000);
const topFindings = findings.slice(0, 20).map(findingLine).join('\n');
const isClean = scanOutcome === 'success' && findingsParsed && findings.length === 0;

const octokit = new Octokit({ auth: token });
const issues = await octokit.paginate(octokit.issues.listForRepo, {
  owner,
  repo,
  state: 'open',
  per_page: 100
});
const existing = issues.find((issue) => !issue.pull_request && issue.title === issueTitle);

if (isClean) {
  if (existing) {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: existing.number,
      body: `Codex Security completed without findings.\n\nWorkflow run: ${runUrl}\nCommit: ${commitSha}`
    });
    await octokit.issues.update({ owner, repo, issue_number: existing.number, state: 'closed' });
    console.log(`Closed ${owner}/${repo}#${existing.number} after a clean scan.`);
  } else {
    console.log('Scan completed without findings; no issue created.');
  }
  process.exit(0);
}

const body = [
  '## Codex Security scan for HELIOS-NET',
  '',
  `- **Status:** ${scanOutcome}`,
  `- **Findings:** ${findingsParsed ? findings.length : 'unavailable'}`,
  `- **Severity:** ${findingsParsed ? severitySummary : 'unavailable'}`,
  `- **Commit:** \`${commitSha}\``,
  `- **Ref:** \`${ref}\``,
  `- **Workflow run:** ${runUrl || 'not available'}`,
  '',
  cliError ? `### Scanner message\n\n${cliError}\n` : '',
  topFindings ? `### Top findings\n\n${topFindings}\n` : '',
  report ? `### Report excerpt\n\n${report}` : ''
].filter(Boolean).join('\n').slice(0, 64000);

if (existing) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: existing.number,
    body
  });
  console.log(`Updated ${owner}/${repo}#${existing.number}.`);
} else {
  const created = await octokit.issues.create({
    owner,
    repo,
    title: issueTitle,
    body
  });
  console.log(`Created ${owner}/${repo}#${created.data.number}.`);
}
