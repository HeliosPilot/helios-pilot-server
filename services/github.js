import { Octokit } from "@octokit/rest";
import crypto from 'crypto';

export function verifyGitHubSignature(req) {
  const signature = req.headers["x-hub-signature-256"];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!signature || !secret) return true;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (e) {
    return false;
  }
}

export function generateGitHubAppJWT() {
  const appId = process.env.APP_ID;
  let privateKey = process.env.PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials (APP_ID or PRIVATE_KEY) are missing.");
  }

  privateKey = privateKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + (10 * 60),
    iss: appId
  };

  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signInput = `${encodedHeader}.${encodedPayload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(privateKey, "base64url");

  return `${signInput}.${signature}`;
}

export async function getInstallationOctokitForRepo(owner, repo) {
  try {
    const jwtToken = generateGitHubAppJWT();
    const octokit = new Octokit({ auth: jwtToken });
    const { data: installations } = await octokit.apps.listInstallations();

    for (const installation of installations) {
      const { data: accessTokenData } = await octokit.apps.createInstallationAccessToken({
        installation_id: installation.id,
      });
      const tempOctokit = new Octokit({ auth: accessTokenData.token });
      
      try {
        const { data: repoData } = await tempOctokit.repos.get({ owner, repo });
        if (repoData) return tempOctokit;
      } catch (e) {}
    }
  } catch (error) {
    console.error("Error finding installation Octokit:", error);
  }
  return null;
}

export async function addCommentToIssueOrPR(url, commentBody) {
  try {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/);
    if (!match) return "⚠️ رابط GitHub غير صالح لإضافة تعليق (يجب أن يكون رابط Issue أو Pull Request مباشر).";

    const [, owner, repo, type, number] = match;
    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    
    if (!repoOctokit) {
      return `🛑 **صلاحيات مفقودة:** المستودع \`${owner}/${repo}\` غير مقترن بـ GitHub App.`;
    }

    await repoOctokit.issues.createComment({
      owner,
      repo,
      issue_number: parseInt(number),
      body: commentBody
    });

    return `✅ **تم النشر بنجاح:** أُضيف التعليق على ${type === 'pull' ? 'PR' : 'Issue'} #${number} في (\`${owner}/${repo}\`).`;
  } catch (error) {
    return `❌ **فشل النشر:** ${error.message}`;
  }
}

export async function createBranch(owner, repo, branchName, baseBranch = "main") {
  const octokit = await getInstallationOctokitForRepo(owner, repo);
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`
  }).catch(() => octokit.git.getRef({ owner, repo, ref: "heads/master" }));
  
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha
  });
}

export async function createAutomatedPR(owner, repo, taskType, fixContent, filePath) {
  try {
    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    if (!repoOctokit) throw new Error("لا توجد صلاحيات للمستودع.");

    const { data: ref } = await repoOctokit.git.getRef({ owner, repo, ref: "heads/master" }).catch(() => repoOctokit.git.getRef({ owner, repo, ref: "heads/main" }));
    const sha = ref.object.sha;

    const newBranch = `helios-pilot/${taskType}-${Date.now()}`;
    await repoOctokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: sha
    });

    const { data: file } = await repoOctokit.repos.getContent({ owner, repo, path: filePath });
    await repoOctokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `🛠️ ${taskType}: Automated fix by HeliosPilot`,
      content: Buffer.from(fixContent).toString('base64'),
      sha: file.sha,
      branch: newBranch
    });

    const { data: pr } = await repoOctokit.pulls.create({
      owner,
      repo,
      title: `🛠️ ${taskType}: Automated Fix`,
      body: `⚡ **HeliosPilot AI Agent** generated an automated fix for: ${taskType}.\n\n**Analysis:** The bot analyzed the codebase and applied the following patch.`,
      head: newBranch,
      base: ref.ref.replace("refs/heads/", "")
    });

    return `✅ **تم إنشاء PR بنجاح:** ${pr.html_url}`;
  } catch (error) {
    console.error("Error creating Auto-Patch PR:", error);
    throw error;
  }
}

export async function createFileInRepo(owner, repo, filePath, fileContent, commitMessage) {
  try {
    const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
    if (!repoOctokit) throw new Error("لا توجد صلاحيات للمستودع.");

    const { data: ref } = await repoOctokit.git.getRef({ owner, repo, ref: "heads/master" }).catch(() => repoOctokit.git.getRef({ owner, repo, ref: "heads/main" }));
    const sha = ref.object.sha;

    const newBranch = `helios-pilot/create-${filePath.replace(/\//g, '-')}-${Date.now()}`;
    await repoOctokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: sha
    });

    await repoOctokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(fileContent).toString('base64'),
      branch: newBranch
    });

    const { data: pr } = await repoOctokit.pulls.create({
      owner,
      repo,
      title: `📝 ${commitMessage}`,
      body: `⚡ **HeliosPilot AI Agent** created this file automatically.`,
      head: newBranch,
      base: ref.ref.replace("refs/heads/", "")
    });

    return `✅ **تم إنشاء الملف بنجاح وفتح PR:** ${pr.html_url}`;
  } catch (error) {
    console.error("Error creating file in repo:", error);
    throw error;
  }
}

export async function parseAndFetchGitHubUrl(url) {
  try {
    const issueMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
    if (issueMatch) {
      const [, owner, repo, issueNumber] = issueMatch;
      const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
      if (!repoOctokit) return `🛑 المستودع \`${owner}/${repo}\` غير مرتبط بـ GitHub App.`;

      const { data: issue } = await repoOctokit.issues.get({ owner, repo, issue_number: parseInt(issueNumber) });
      const { data: comments } = await repoOctokit.issues.listComments({ owner, repo, issue_number: parseInt(issueNumber) });

      const commentsText = comments.length > 0 
        ? comments.map(c => `- @${c.user.login}: ${c.body}`).join("\n") 
        : "No comments yet.";

      return `📌 **Issue #${issueNumber} (${owner}/${repo}):**\n` +
        `- **Title:** ${issue.title}\n` +
        `- **State:** ${issue.state}\n` +
        `- **Author:** @${issue.user.login}\n` +
        `- **Body:**\n${issue.body || "No description."}\n\n` +
        `💬 **Comments (${comments.length}):**\n${commentsText}`;
    }

    const prMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (prMatch) {
      const [, owner, repo, prNumber] = prMatch;
      const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
      if (!repoOctokit) return `🛑 المستودع \`${owner}/${repo}\` غير مرتبط بـ GitHub App.`;

      const { data: pr } = await repoOctokit.pulls.get({ owner, repo, pull_number: parseInt(prNumber) });
      const { data: files } = await repoOctokit.pulls.listFiles({ owner, repo, pull_number: parseInt(prNumber) });
      const filesSummary = files.map(f => `- \`${f.filename}\` (${f.status}: +${f.additions}, -${f.deletions})`).join("\n");

      return `🔀 **Pull Request #${prNumber} (${owner}/${repo}):**\n` +
        `- **Title:** ${pr.title}\n` +
        `- **State:** ${pr.state}\n` +
        `- **Branches:** ${pr.head.ref} ⬅️ ${pr.base.ref}\n` +
        `- **Body:**\n${pr.body || "No description."}\n\n` +
        `📂 **Modified Files (${files.length}):**\n${filesSummary}`;
    }

    const actionsMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/actions/);
    if (actionsMatch) {
      const [, owner, repo] = actionsMatch;
      const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
      if (!repoOctokit) return `🛑 المستودع \`${owner}/${repo}\` غير مرتبط بـ GitHub App.`;

      const { data: runsData } = await repoOctokit.actions.listWorkflowRunsForRepo({ owner, repo, per_page: 5 });
      const runsSummary = runsData.workflow_runs.map(r => 
        `- **${r.name}** (#${r.run_number}): \`${r.conclusion || r.status}\` (${r.html_url})`
      ).join("\n");

      return `🚀 **GitHub Actions Workflows (${owner}/${repo}):**\n` +
        `Total Runs Found: ${runsData.total_count}\n` +
        `Recent Runs:\n${runsSummary || "No workflow runs found."}`;
    }

    const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (repoMatch) {
      const owner = repoMatch[1];
      const repo = repoMatch[2].replace(/\/(issues|pulls|actions|settings|tree.*)?$/, "");

      const repoOctokit = await getInstallationOctokitForRepo(owner, repo);
      if (!repoOctokit) return `🛑 المستودع \`${owner}/${repo}\` غير مرتبط بـ GitHub App.`;

      const { data: contents } = await repoOctokit.repos.getContent({ owner, repo, path: "" });
      const fileList = Array.isArray(contents) ? contents.map(f => f.name).join(", ") : "Main entry";

      return `📂 **Repository Data (${owner}/${repo}):**\n- Files: ${fileList}`;
    }

    return "Invalid or unsupported GitHub URL.";
  } catch (error) {
    return `Error reading from GitHub: ${error.message}`;
  }
}

export async function fetchAppInstallationsAndRepos() {
  try {
    const jwtToken = generateGitHubAppJWT();
    const octokit = new Octokit({ auth: jwtToken });
    const { data: installations } = await octokit.apps.listInstallations();
    
    if (!installations || installations.length === 0) {
      return ["⚠️ GitHub App is not installed on any repository yet."];
    }

    let allRepos = [];
    for (const installation of installations) {
      const { data: accessTokenData } = await octokit.apps.createInstallationAccessToken({
        installation_id: installation.id,
      });

      const installationOctokit = new Octokit({ auth: accessTokenData.token });
      const { data: reposData } = await installationOctokit.apps.listReposAccessibleToInstallation();

      for (const repo of reposData.repositories) {
        allRepos.push(`[${repo.full_name}](${repo.html_url}) - ${repo.description || "No description"}`);
      }
    }
    return allRepos;
  } catch (error) {
    return [`Connection error: ${error.message}`];
  }
}
