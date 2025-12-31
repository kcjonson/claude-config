#!/usr/bin/env node

/**
 * Bulk reply to PR comments.
 * Designed to work with output from fetch-pr-comments.js
 *
 * Usage:
 *   echo '[{"id": 123, "body": "Fixed"}]' | ./reply-pr-comments.js
 *   ./reply-pr-comments.js --file replies.json
 *   ./reply-pr-comments.js --dry-run < replies.json
 *
 * Input format (JSON array via stdin or file):
 * [
 *   { "id": 12345, "body": "Fixed in abc123", "type": "inline" },
 *   { "id": 67890, "body": "Good catch, updated", "type": "inline" },
 *   { "id": "review-body-111", "body": "Thanks for the review!", "type": "review-body" },
 *   { "id": 99999, "body": "Addressed this concern", "type": "conversation" }
 * ]
 *
 * Types:
 *   - inline: Reply to inline review comment (POST /pulls/{pr}/comments/{id}/replies)
 *   - inline-reply: Same as inline (replies go to the thread root)
 *   - conversation: Create new issue comment (POST /issues/{pr}/comments)
 *   - review-body: Create new issue comment (POST /issues/{pr}/comments)
 *
 * Options:
 *   --dry-run       Preview what would be sent without actually posting
 *   --file <path>   Read replies from file instead of stdin
 *   --pr <number>   Override PR number (default: current branch's PR)
 *   --branch <name> Use PR for specified branch
 *   --delay <ms>    Delay between requests in ms (default: 100)
 */

const { execSync } = require('child_process');
const fs = require('fs');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  } catch (err) {
    return { error: true, stderr: err.stderr, stdout: err.stdout };
  }
}

function execJson(cmd) {
  const output = exec(cmd);
  if (output.error) {
    throw new Error(output.stderr);
  }
  try {
    return JSON.parse(output);
  } catch (e) {
    console.error(`Failed to parse JSON from command: ${cmd}`);
    throw e;
  }
}

function getCurrentRepo() {
  const repoInfo = execJson('gh repo view --json nameWithOwner');
  return repoInfo.nameWithOwner;
}

function getCurrentPrNumber() {
  try {
    const prInfo = execJson('gh pr view --json number');
    return prInfo.number;
  } catch (e) {
    return null;
  }
}

function getPrNumberForBranch(branch) {
  try {
    const prInfo = execJson(`gh pr view "${branch}" --json number`);
    return prInfo.number;
  } catch (e) {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeForShell(str) {
  // Escape for use in single quotes
  return str.replace(/'/g, "'\\''");
}

function parseArgs(args) {
  const result = {
    dryRun: false,
    file: null,
    pr: null,
    branch: null,
    delay: 100
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--file' && args[i + 1]) {
      result.file = args[++i];
    } else if (arg === '--pr' && args[i + 1]) {
      result.pr = parseInt(args[++i], 10);
    } else if (arg === '--branch' && args[i + 1]) {
      result.branch = args[++i];
    } else if (arg === '--delay' && args[i + 1]) {
      result.delay = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Bulk reply to PR comments.

Usage:
  echo '[{"id": 123, "body": "Fixed"}]' | ./reply-pr-comments.js
  ./reply-pr-comments.js --file replies.json
  ./reply-pr-comments.js --dry-run < replies.json

Input format (JSON array):
  [
    { "id": 12345, "body": "Fixed in abc123", "type": "inline" },
    { "id": 67890, "body": "Addressed", "type": "conversation" }
  ]

Options:
  --dry-run       Preview without posting
  --file <path>   Read from file instead of stdin
  --pr <number>   Override PR number
  --branch <name> Use PR for specified branch
  --delay <ms>    Delay between requests (default: 100)
  --help          Show this help
`);
      process.exit(0);
    }
  }

  return result;
}

async function readInput(filePath) {
  if (filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  // Read from stdin
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Failed to parse JSON input: ${e.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

async function postReply(repo, prNumber, reply, dryRun) {
  const { id, body, type } = reply;

  // Determine the API endpoint based on type
  let cmd;
  let description;

  if (type === 'inline' || type === 'inline-reply') {
    // For inline-reply, we need the parent comment ID, but if someone is replying
    // to an inline-reply, they probably want to reply to the same thread.
    // The id in the input should be the comment to reply to.
    const commentId = String(id).replace('review-body-', '');
    cmd = `gh api repos/${repo}/pulls/${prNumber}/comments/${commentId}/replies -f body='${escapeForShell(body)}'`;
    description = `Reply to inline comment #${commentId}`;
  } else if (type === 'conversation' || type === 'review-body') {
    // For conversation comments and review bodies, we create a new issue comment
    // We can mention the original if needed
    cmd = `gh api repos/${repo}/issues/${prNumber}/comments -f body='${escapeForShell(body)}'`;
    description = `New conversation comment (re: ${type} #${id})`;
  } else {
    // Default to inline reply
    cmd = `gh api repos/${repo}/pulls/${prNumber}/comments/${id}/replies -f body='${escapeForShell(body)}'`;
    description = `Reply to comment #${id}`;
  }

  if (dryRun) {
    return { success: true, dryRun: true, description, cmd };
  }

  const result = exec(cmd);
  if (result.error) {
    return { success: false, error: result.stderr, description, cmd };
  }

  try {
    const response = JSON.parse(result);
    return { success: true, description, url: response.html_url };
  } catch (e) {
    return { success: true, description, raw: result };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Get repo
  const repo = getCurrentRepo();

  // Get PR number
  let prNumber = args.pr;
  if (!prNumber && args.branch) {
    prNumber = getPrNumberForBranch(args.branch);
  }
  if (!prNumber) {
    prNumber = getCurrentPrNumber();
  }

  if (!prNumber) {
    console.error('Could not determine PR number. Use --pr or --branch option.');
    process.exit(1);
  }

  console.error(`Replying to PR #${prNumber} in ${repo}`);
  if (args.dryRun) {
    console.error('DRY RUN - no comments will be posted\n');
  }

  // Read input
  let replies;
  try {
    replies = await readInput(args.file);
  } catch (e) {
    console.error(`Error reading input: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(replies)) {
    console.error('Input must be a JSON array of replies');
    process.exit(1);
  }

  if (replies.length === 0) {
    console.error('No replies to post');
    process.exit(0);
  }

  console.error(`Processing ${replies.length} replies...\n`);

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < replies.length; i++) {
    const reply = replies[i];

    if (!reply.id || !reply.body) {
      console.error(`[${i + 1}/${replies.length}] SKIP - Missing id or body`);
      results.failed.push({ reply, error: 'Missing id or body' });
      continue;
    }

    // Default type to inline if not specified
    if (!reply.type) {
      reply.type = 'inline';
    }

    const result = await postReply(repo, prNumber, reply, args.dryRun);

    if (result.success) {
      const status = args.dryRun ? 'WOULD POST' : 'POSTED';
      console.error(`[${i + 1}/${replies.length}] ${status}: ${result.description}`);
      if (args.dryRun) {
        console.error(`    Command: ${result.cmd}`);
      } else if (result.url) {
        console.error(`    URL: ${result.url}`);
      }
      results.success.push({ reply, result });
    } else {
      console.error(`[${i + 1}/${replies.length}] FAILED: ${result.description}`);
      console.error(`    Error: ${result.error}`);
      results.failed.push({ reply, error: result.error });
    }

    // Delay between requests to avoid rate limiting
    if (i < replies.length - 1 && !args.dryRun) {
      await sleep(args.delay);
    }
  }

  // Summary
  console.error('\n=== Summary ===');
  console.error(`Success: ${results.success.length}`);
  console.error(`Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.error('\nFailed replies:');
    for (const f of results.failed) {
      console.error(`  - ID ${f.reply.id}: ${f.error}`);
    }
  }

  // Output results as JSON to stdout
  console.log(JSON.stringify(results, null, 2));

  process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
