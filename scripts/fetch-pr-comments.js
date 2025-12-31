#!/usr/bin/env node

/**
 * Fetches ALL comments from a GitHub PR and organizes them hierarchically.
 * Designed to be consumed by /pr-feedback action for reliable comment processing.
 *
 * Usage:
 *   ./fetch-pr-comments.js                         # Current branch's PR (JSON)
 *   ./fetch-pr-comments.js --format=markdown       # Current branch's PR (markdown)
 *   ./fetch-pr-comments.js 123                     # Specific PR number
 *   ./fetch-pr-comments.js feature/my-branch       # PR for a specific branch
 *   ./fetch-pr-comments.js owner/repo 123          # Specific repo and PR
 *
 * Options:
 *   --format=json      Output as JSON (default)
 *   --format=markdown  Output as markdown (optimized for LLM consumption)
 *
 * Output structure designed for pr-feedback consumption:
 * {
 *   meta: { repo, prNumber, fetchedAt },
 *   pr: { number, title, url, state, author, headSha, ... },
 *   reviews: {
 *     [reviewId]: {
 *       id, author, state, body, submittedAt,
 *       comments: {
 *         [commentId]: {
 *           id, path, line, body, author, createdAt, htmlUrl,
 *           replies: { [replyId]: {...} }
 *         }
 *       }
 *     }
 *   },
 *   issueComments: {
 *     [commentId]: { id, author, body, createdAt, htmlUrl }
 *   },
 *   orphanedComments: { ... },
 *
 *   // Flat list for easy iteration - every comment in one place
 *   allComments: [
 *     { id, type, author, location, body, isReply, parentId, replyToApi, ... }
 *   ],
 *
 *   stats: { ... }
 * }
 */

const { execSync } = require('child_process');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  } catch (err) {
    if (err.stderr) {
      console.error(`Command failed: ${cmd}`);
      console.error(err.stderr);
    }
    throw err;
  }
}

function execJson(cmd) {
  const output = exec(cmd);
  try {
    return JSON.parse(output);
  } catch (e) {
    console.error(`Failed to parse JSON from command: ${cmd}`);
    console.error(`Output was: ${output.substring(0, 500)}`);
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
    console.error('No PR found for current branch. Please specify a PR number or branch name.');
    process.exit(1);
  }
}

function getPrNumberForBranch(branch) {
  try {
    const prInfo = execJson(`gh pr view "${branch}" --json number`);
    return prInfo.number;
  } catch (e) {
    console.error(`No PR found for branch '${branch}'.`);
    process.exit(1);
  }
}

function isNumeric(str) {
  return /^\d+$/.test(str);
}

function fetchPrOverview(repo, prNumber) {
  return execJson(`gh api repos/${repo}/pulls/${prNumber}`);
}

function fetchReviews(repo, prNumber) {
  return execJson(`gh api repos/${repo}/pulls/${prNumber}/reviews --paginate`);
}

function fetchReviewComments(repo, prNumber) {
  return execJson(`gh api repos/${repo}/pulls/${prNumber}/comments --paginate`);
}

function fetchIssueComments(repo, prNumber) {
  return execJson(`gh api repos/${repo}/issues/${prNumber}/comments --paginate`);
}

function buildHierarchy(repo, prNumber, prOverview, reviews, reviewComments, issueComments) {
  const headSha = prOverview.head?.sha;

  const result = {
    meta: {
      repo,
      prNumber,
      fetchedAt: new Date().toISOString(),
      // API endpoints for replying (for pr-feedback to use)
      replyEndpoints: {
        reviewComment: `repos/${repo}/pulls/${prNumber}/comments/{comment_id}/replies`,
        issueComment: `repos/${repo}/issues/${prNumber}/comments`
      }
    },
    pr: {
      number: prOverview.number,
      title: prOverview.title,
      body: prOverview.body || '',
      url: prOverview.html_url,
      state: prOverview.state,
      author: prOverview.user?.login,
      headSha: headSha,
      baseBranch: prOverview.base?.ref,
      headBranch: prOverview.head?.ref,
      updatedAt: prOverview.updated_at,
      createdAt: prOverview.created_at,
      changedFiles: prOverview.changed_files,
      additions: prOverview.additions,
      deletions: prOverview.deletions
    },
    reviews: {},
    issueComments: {},
    orphanedComments: {},
    allComments: [], // Flat list for easy iteration
    stats: {
      totalReviews: 0,
      totalReviewBodies: 0, // Reviews with non-empty body
      totalReviewComments: 0,
      totalIssueComments: 0,
      totalReplies: 0,
      totalAllComments: 0
    }
  };

  // Build maps for processing
  const allReviewComments = {};
  const topLevelComments = []; // Comments that are not replies

  // First pass: index all review comments
  for (const comment of reviewComments) {
    const isOnCurrentCommit = comment.commit_id === headSha;

    allReviewComments[comment.id] = {
      id: comment.id,
      path: comment.path,
      line: comment.line || comment.original_line,
      originalLine: comment.original_line,
      side: comment.side, // LEFT or RIGHT
      diffHunk: comment.diff_hunk,
      body: comment.body,
      author: comment.user?.login,
      authorAssociation: comment.author_association,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      htmlUrl: comment.html_url,
      inReplyToId: comment.in_reply_to_id || null,
      pullRequestReviewId: comment.pull_request_review_id,
      commitId: comment.commit_id,
      isOnCurrentCommit,
      replies: {},
      _isReply: false
    };

    if (!comment.in_reply_to_id) {
      topLevelComments.push(comment.id);
    }
  }

  // Second pass: build reply chains
  for (const comment of reviewComments) {
    if (comment.in_reply_to_id && allReviewComments[comment.in_reply_to_id]) {
      const parent = allReviewComments[comment.in_reply_to_id];
      parent.replies[comment.id] = allReviewComments[comment.id];
      allReviewComments[comment.id]._isReply = true;
      result.stats.totalReplies++;
    }
  }

  // Build reviews structure
  for (const review of reviews) {
    const hasBody = review.body && review.body.trim().length > 0;

    result.reviews[review.id] = {
      id: review.id,
      author: review.user?.login,
      authorAssociation: review.author_association,
      state: review.state,
      body: review.body || '',
      submittedAt: review.submitted_at,
      commitId: review.commit_id,
      htmlUrl: review.html_url,
      isOnCurrentCommit: review.commit_id === headSha,
      comments: {}
    };
    result.stats.totalReviews++;

    if (hasBody) {
      result.stats.totalReviewBodies++;
      // Add review body as a comment to allComments
      result.allComments.push({
        id: `review-body-${review.id}`,
        type: 'review-body',
        reviewId: review.id,
        author: review.user?.login,
        authorAssociation: review.author_association,
        body: review.body,
        location: 'general',
        path: null,
        line: null,
        createdAt: review.submitted_at,
        htmlUrl: review.html_url,
        isReply: false,
        parentId: null,
        isOnCurrentCommit: review.commit_id === headSha,
        reviewState: review.state,
        // For replying to reviews, you typically create a new issue comment
        replyMethod: 'issue-comment'
      });
    }
  }

  // Assign comments to reviews and build allComments
  for (const commentId of topLevelComments) {
    const comment = allReviewComments[commentId];
    const reviewId = comment.pullRequestReviewId;

    if (reviewId && result.reviews[reviewId]) {
      result.reviews[reviewId].comments[commentId] = comment;
    } else {
      result.orphanedComments[commentId] = comment;
    }
    result.stats.totalReviewComments++;

    // Add to flat list
    result.allComments.push({
      id: comment.id,
      type: 'inline',
      reviewId: comment.pullRequestReviewId,
      author: comment.author,
      authorAssociation: comment.authorAssociation,
      body: comment.body,
      location: `${comment.path}:${comment.line || comment.originalLine || '?'}`,
      path: comment.path,
      line: comment.line || comment.originalLine,
      diffHunk: comment.diffHunk,
      createdAt: comment.createdAt,
      htmlUrl: comment.htmlUrl,
      isReply: false,
      parentId: null,
      isOnCurrentCommit: comment.isOnCurrentCommit,
      // API for replying to this specific comment thread
      replyApi: `gh api repos/${repo}/pulls/${prNumber}/comments/${comment.id}/replies -f body="YOUR_REPLY"`,
      replyCount: Object.keys(comment.replies).length
    });

    // Add replies to flat list
    for (const [replyId, reply] of Object.entries(comment.replies)) {
      result.allComments.push({
        id: reply.id,
        type: 'inline-reply',
        reviewId: reply.pullRequestReviewId,
        author: reply.author,
        authorAssociation: reply.authorAssociation,
        body: reply.body,
        location: `${reply.path}:${reply.line || reply.originalLine || '?'}`,
        path: reply.path,
        line: reply.line || reply.originalLine,
        createdAt: reply.createdAt,
        htmlUrl: reply.htmlUrl,
        isReply: true,
        parentId: comment.id,
        isOnCurrentCommit: reply.isOnCurrentCommit,
        // Replies to replies still use the original comment's thread
        replyApi: `gh api repos/${repo}/pulls/${prNumber}/comments/${comment.id}/replies -f body="YOUR_REPLY"`
      });
    }
  }

  // Add issue comments (conversation-style)
  for (const comment of issueComments) {
    result.issueComments[comment.id] = {
      id: comment.id,
      body: comment.body,
      author: comment.user?.login,
      authorAssociation: comment.author_association,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      htmlUrl: comment.html_url
    };
    result.stats.totalIssueComments++;

    // Add to flat list
    result.allComments.push({
      id: comment.id,
      type: 'conversation',
      author: comment.user?.login,
      authorAssociation: comment.author_association,
      body: comment.body,
      location: 'general',
      path: null,
      line: null,
      createdAt: comment.created_at,
      htmlUrl: comment.html_url,
      isReply: false,
      parentId: null,
      isOnCurrentCommit: true, // Conversation comments aren't tied to commits
      // Issue comments are replied to by creating new issue comments
      replyMethod: 'issue-comment',
      replyApi: `gh api repos/${repo}/issues/${prNumber}/comments -f body="YOUR_REPLY"`
    });
  }

  // Sort allComments by createdAt
  result.allComments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  result.stats.totalAllComments = result.allComments.length;

  return result;
}

function printSummary(result) {
  console.error('\n=== PR Comment Fetch Summary ===');
  console.error(`PR #${result.pr.number}: ${result.pr.title}`);
  console.error(`URL: ${result.pr.url}`);
  console.error(`State: ${result.pr.state} | Author: ${result.pr.author}`);
  console.error(`Head SHA: ${result.pr.headSha?.substring(0, 7)}`);
  console.error('');
  console.error('Stats:');
  console.error(`  Reviews: ${result.stats.totalReviews} (${result.stats.totalReviewBodies} with body text)`);
  console.error(`  Inline comments: ${result.stats.totalReviewComments}`);
  console.error(`  Reply threads: ${result.stats.totalReplies}`);
  console.error(`  Conversation comments: ${result.stats.totalIssueComments}`);
  console.error(`  Orphaned comments: ${Object.keys(result.orphanedComments).length}`);
  console.error(`  ─────────────────────`);
  console.error(`  TOTAL ITEMS: ${result.stats.totalAllComments}`);
  console.error('');

  // List reviews
  const reviewIds = Object.keys(result.reviews);
  if (reviewIds.length > 0) {
    console.error('Reviews by author:');
    for (const reviewId of reviewIds) {
      const review = result.reviews[reviewId];
      const commentCount = Object.keys(review.comments).length;
      const replyCount = Object.values(review.comments).reduce(
        (sum, c) => sum + Object.keys(c.replies).length, 0
      );
      const bodyIndicator = review.body ? ' [has body]' : '';
      const currentIndicator = review.isOnCurrentCommit ? '' : ' [old commit]';
      console.error(`  @${review.author} (${review.state}): ${commentCount} comments, ${replyCount} replies${bodyIndicator}${currentIndicator}`);
    }
    console.error('');
  }

  // Quick summary of comments by author (excluding self)
  const authorCounts = {};
  for (const comment of result.allComments) {
    if (comment.author !== result.pr.author) {
      authorCounts[comment.author] = (authorCounts[comment.author] || 0) + 1;
    }
  }
  if (Object.keys(authorCounts).length > 0) {
    console.error('Feedback by reviewer:');
    for (const [author, count] of Object.entries(authorCounts).sort((a, b) => b[1] - a[1])) {
      console.error(`  @${author}: ${count} comments`);
    }
    console.error('');
  }
}

function formatMarkdown(result) {
  const lines = [];
  const { pr, stats, allComments, meta } = result;

  // Header
  lines.push(`# PR #${pr.number}: ${pr.title}`);
  lines.push('');
  lines.push(`**URL:** ${pr.url}`);
  lines.push(`**State:** ${pr.state} | **Author:** @${pr.author} | **Branch:** ${pr.headBranch} → ${pr.baseBranch}`);
  lines.push(`**Head SHA:** ${pr.headSha?.substring(0, 7)}`);
  lines.push('');

  // Stats
  lines.push('## Stats');
  lines.push(`- **Total comments to address:** ${stats.totalAllComments}`);
  lines.push(`- Reviews: ${stats.totalReviews} (${stats.totalReviewBodies} with body)`);
  lines.push(`- Inline comments: ${stats.totalReviewComments}`);
  lines.push(`- Replies: ${stats.totalReplies}`);
  lines.push(`- Conversation comments: ${stats.totalIssueComments}`);
  lines.push('');

  // Reviews summary
  const reviewIds = Object.keys(result.reviews);
  if (reviewIds.length > 0) {
    lines.push('## Reviews');
    for (const reviewId of reviewIds) {
      const review = result.reviews[reviewId];
      const stateEmoji = {
        'APPROVED': '✅',
        'CHANGES_REQUESTED': '🔴',
        'COMMENTED': '💬',
        'PENDING': '⏳',
        'DISMISSED': '❌'
      }[review.state] || '❓';
      lines.push(`- ${stateEmoji} **@${review.author}** - ${review.state}`);
    }
    lines.push('');
  }

  // All comments - grouped by file for inline, then general
  lines.push('## All Comments');
  lines.push('');

  // Group by location
  const byFile = {};
  const general = [];

  for (const comment of allComments) {
    if (comment.path) {
      if (!byFile[comment.path]) {
        byFile[comment.path] = [];
      }
      byFile[comment.path].push(comment);
    } else {
      general.push(comment);
    }
  }

  // Output file-based comments
  const filePaths = Object.keys(byFile).sort();
  for (const filePath of filePaths) {
    const comments = byFile[filePath];
    lines.push(`### \`${filePath}\``);
    lines.push('');

    for (const c of comments) {
      const indent = c.isReply ? '  ' : '';
      const replyIndicator = c.isReply ? '↳ ' : '';
      const lineInfo = c.line ? `:${c.line}` : '';
      const outdated = c.isOnCurrentCommit ? '' : ' [outdated]';

      lines.push(`${indent}${replyIndicator}**@${c.author}** (${c.type})${outdated}`);

      // Body - indent and truncate if very long
      const bodyLines = c.body.split('\n');
      const truncated = bodyLines.length > 10;
      const displayLines = truncated ? bodyLines.slice(0, 10) : bodyLines;

      for (const bodyLine of displayLines) {
        lines.push(`${indent}> ${bodyLine}`);
      }
      if (truncated) {
        lines.push(`${indent}> ... (truncated, ${bodyLines.length - 10} more lines)`);
      }

      // Reply command
      if (!c.isReply && c.replyApi) {
        lines.push(`${indent}📝 Reply: \`${c.replyApi.replace('YOUR_REPLY', '...')}\``);
      }
      lines.push('');
    }
  }

  // Output general comments
  if (general.length > 0) {
    lines.push('### General Comments');
    lines.push('');

    for (const c of general) {
      const typeLabel = c.type === 'review-body' ? `review-body (${c.reviewState})` : c.type;
      lines.push(`**@${c.author}** (${typeLabel})`);

      const bodyLines = c.body.split('\n');
      const truncated = bodyLines.length > 10;
      const displayLines = truncated ? bodyLines.slice(0, 10) : bodyLines;

      for (const bodyLine of displayLines) {
        lines.push(`> ${bodyLine}`);
      }
      if (truncated) {
        lines.push(`> ... (truncated, ${bodyLines.length - 10} more lines)`);
      }

      if (c.replyApi) {
        lines.push(`📝 Reply: \`${c.replyApi.replace('YOUR_REPLY', '...')}\``);
      }
      lines.push('');
    }
  }

  // Summary table for quick reference
  lines.push('## Quick Reference Table');
  lines.push('');
  lines.push('| # | Author | Type | Location | Status |');
  lines.push('|---|--------|------|----------|--------|');

  let idx = 1;
  for (const c of allComments) {
    const status = c.isOnCurrentCommit ? 'current' : 'outdated';
    const location = c.path ? `\`${c.path}:${c.line || '?'}\`` : 'general';
    lines.push(`| ${idx} | @${c.author} | ${c.type} | ${location} | ${status} |`);
    idx++;
  }
  lines.push('');

  // API info for replying
  lines.push('## Reply API Templates');
  lines.push('');
  lines.push('```bash');
  lines.push(`# Reply to inline comment (use comment ID from above):`);
  lines.push(`gh api repos/${meta.repo}/pulls/${meta.prNumber}/comments/{COMMENT_ID}/replies -f body="Your reply"`);
  lines.push('');
  lines.push(`# Add new conversation comment:`);
  lines.push(`gh api repos/${meta.repo}/issues/${meta.prNumber}/comments -f body="Your comment"`);
  lines.push('```');
  lines.push('');

  lines.push(`---`);
  lines.push(`*Fetched at ${meta.fetchedAt}*`);

  return lines.join('\n');
}

function parseArgs(args) {
  const result = {
    format: 'json',
    positional: []
  };

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      result.format = arg.split('=')[1];
    } else if (arg === '--format') {
      // Handle --format markdown (space separated) - skip, next arg handled below
    } else if (result.format === 'json' && args[args.indexOf(arg) - 1] === '--format') {
      result.format = arg;
    } else if (!arg.startsWith('--')) {
      result.positional.push(arg);
    }
  }

  return result;
}

function main() {
  const rawArgs = process.argv.slice(2);
  const { format, positional: args } = parseArgs(rawArgs);

  // Validate format
  if (!['json', 'markdown'].includes(format)) {
    console.error(`Invalid format: ${format}. Use 'json' or 'markdown'.`);
    process.exit(1);
  }

  let repo, prNumber;

  if (args.length === 0) {
    // No args: use current branch's PR
    repo = getCurrentRepo();
    prNumber = getCurrentPrNumber();
  } else if (args.length === 1) {
    repo = getCurrentRepo();
    if (isNumeric(args[0])) {
      // Numeric: treat as PR number
      prNumber = parseInt(args[0], 10);
    } else {
      // Non-numeric: treat as branch name
      console.error(`Looking up PR for branch '${args[0]}'...`);
      prNumber = getPrNumberForBranch(args[0]);
    }
  } else if (args.length === 2) {
    // Two args: owner/repo + PR number
    repo = args[0];
    prNumber = parseInt(args[1], 10);
  } else {
    console.error('Usage:');
    console.error('  fetch-pr-comments.js [options] [target]');
    console.error('');
    console.error('Options:');
    console.error('  --format=json       Output as JSON (default)');
    console.error('  --format=markdown   Output as markdown (optimized for LLM consumption)');
    console.error('');
    console.error('Target (optional):');
    console.error('  <pr-number>              Specific PR by number');
    console.error('  <branch-name>            PR for a specific branch');
    console.error('  <owner/repo> <pr-number> Specific repo and PR');
    console.error('');
    console.error('Examples:');
    console.error('  fetch-pr-comments.js                           # Current branch PR, JSON');
    console.error('  fetch-pr-comments.js --format=markdown         # Current branch PR, markdown');
    console.error('  fetch-pr-comments.js 123                       # PR #123, JSON');
    console.error('  fetch-pr-comments.js --format=markdown 123     # PR #123, markdown');
    console.error('  fetch-pr-comments.js feature/my-branch         # PR for branch');
    process.exit(1);
  }

  if (isNaN(prNumber)) {
    console.error('Invalid PR number');
    process.exit(1);
  }

  console.error(`Fetching PR #${prNumber} from ${repo}...`);

  // Fetch all data
  const prOverview = fetchPrOverview(repo, prNumber);
  const reviews = fetchReviews(repo, prNumber);
  const reviewComments = fetchReviewComments(repo, prNumber);
  const issueComments = fetchIssueComments(repo, prNumber);

  console.error(`Raw counts: ${reviews.length} reviews, ${reviewComments.length} review comments, ${issueComments.length} issue comments`);

  // Build hierarchical structure
  const result = buildHierarchy(repo, prNumber, prOverview, reviews, reviewComments, issueComments);

  // Print summary to stderr (always, regardless of format)
  printSummary(result);

  // Output in requested format to stdout
  if (format === 'markdown') {
    console.log(formatMarkdown(result));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
