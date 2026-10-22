import fs from 'node:fs';
import path from 'node:path';

const workflowsDir = path.join(process.cwd(), '.github', 'workflows');

if (!fs.existsSync(workflowsDir)) {
  console.log('No .github/workflows directory found; skipping action pin check.');
  process.exit(0);
}

const files = fs.readdirSync(workflowsDir).filter((file) => /\.ya?ml$/i.test(file));
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/\buses:\s*['"]?([^'"\s#]+)['"]?/);
    if (!match) return;

    const ref = match[1];
    if (ref.startsWith('./') || ref.startsWith('docker://')) return;

    if (!/@[0-9a-f]{40}$/i.test(ref)) {
      violations.push(`${file}:${index + 1} ${ref}`);
    }
  });
}

if (violations.length > 0) {
  console.error('GitHub Actions must be pinned to full 40-character commit SHAs:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Verified ${files.length} workflow file(s): all external actions are commit-pinned.`);
