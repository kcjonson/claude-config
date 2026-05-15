---
description: Fetch, triage, and address GitHub PR review comments for the current branch. Verifies every comment is acknowledged before considering the task done.
disable-model-invocation: true
allowed-tools: Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh api:*), Bash(git rev-parse:*), Bash(git log:*), Bash(git worktree:*), Bash(node *fetch-pr-comments.js*), Bash(node *reply-pr-comments.js*), Bash(echo *)
---

Review the feedback on the current branch's PR.

**PARAMOUNT RULE 1: EVERY comment on a PR MUST be acknowledged and responded to. Ignoring reviewer feedback is extremely disrespectful. Before considering this task complete, you MUST verify that 100% of comments have been addressed in the final summary. No exceptions.**

**PARAMOUNT RULE 2: Ask ONCE before doing any fixes. The user's decision is "act on this feedback or merge as-is", a single binary at the start, not per-item approval. Present the complete action plan (every fix, every skip-with-reply, every defer) in one table, then ask for a single "go" or "merge as-is". Once approved, execute the entire plan end-to-end without re-prompting on individual items. Per-item confirmation defeats the point of the skill.**

## Step 1: Identify the PR, Worktree Context, and Latest Commit

### 1a: Check Worktree Context

1. Determine if we're in a worktree or main checkout:
   ```bash
   git rev-parse --git-dir
   ```
   - If contains `.git/worktrees/` → we're in a worktree
   - If just `.git` → we're in the main checkout

2. List all worktrees to understand the landscape:
   ```bash
   git worktree list
   ```

### 1b: Identify the PR

1. Get the current branch: `git rev-parse --abbrev-ref HEAD`
2. Find the PR for this branch: `gh pr view --json number,headRefOid,updatedAt,headRefName`
3. Get the most recent commit on the PR branch (by SHA and timestamp):
   - `git log -1 --format="%H %ci" HEAD`

### 1c: Verify Correct Working Location

**Critical check:** Compare current branch to PR's branch.

- If current branch matches PR branch → Proceed with fixes
- If on `main` but PR is for a feature branch → **STOP**
  - Warn: "This PR is for branch `feature/x`, but you're in the main checkout."
  - Check if worktree exists: "The branch exists in `.worktrees/x/`"
  - Advise: "To address this feedback, open a terminal in `.worktrees/x/` and run `/pr-feedback` there."
  - Do NOT make changes from the wrong location

**Why this matters:** With git worktrees, each worktree has its own working files. Editing from main checkout won't affect the feature branch's worktree.

## Step 2: Check CI Status FIRST

**CI failures are blocking and must be addressed before review comments.**

### 2a: Get CI Status

```bash
gh pr checks {PR_NUMBER}
```

This shows all CI checks and their status (pass/fail/pending).

### 2b: Prioritize CI Failures

**If any CI checks are failing:**
1. **STOP** - Do not proceed to review comments yet
2. Present CI failures as the top priority:

| Check | Status | Details |
|-------|--------|---------|
| build | Failed | "CMake error on line 42..." |
| tests | Failed | "2 tests failed in renderer..." |
| lint | Passed | - |

3. Fix CI failures first:
   - Read the failure logs
   - Identify the root cause
   - Make fixes
   - Push and wait for CI to re-run

4. Only proceed to review comments after CI is green

**If all CI checks pass:**
- Proceed to Step 3 (fetch review feedback)

**Why CI first:** Reviewers often won't look at a PR with failing CI. Fixing CI failures may also resolve some review comments (e.g., "this doesn't compile" comments become moot).

## Step 3: Fetch ALL PR Comments Using Script

**CRITICAL: Use the bundled fetch script to reliably fetch ALL comments. This ensures nothing is missed.**

```bash
node ${CLAUDE_SKILL_DIR}/scripts/fetch-pr-comments.js --format=markdown
```

This script:
- Fetches all reviews, inline comments, conversation comments, and reply threads
- Groups comments hierarchically by review and file
- Provides exact comment counts for verification
- Includes reply API commands for each comment
- Outputs in markdown format optimized for processing

The output includes:
- **Stats section**: Total counts you MUST verify against at the end
- **All Comments section**: Every comment grouped by file, with full body text
- **Quick Reference Table**: Numbered list of all comments for tracking
- **Reply API Templates**: Commands to reply to comments

### Alternative: Manual Fetch (if script unavailable)

If the script is not available, fall back to manual API calls:

#### 3a: Get PR Overview

```bash
gh pr view {PR_NUMBER} --json title,body,commits,files,reviews,comments,labels,headRefOid,updatedAt,url
```

#### 3b: Fetch ALL Review Comments (Inline Code Comments)

```bash
gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments --paginate
```

#### 3c: Fetch ALL Issue-Style Comments

```bash
gh api repos/{owner}/{repo}/issues/{PR_NUMBER}/comments --paginate
```

### 3d: Verify Comment Count

From the script output stats (or manual tally):
- **GRAND TOTAL: ___**

You will use this count to verify you addressed everything in the final summary.

**DO NOT SKIP ANY COMMENTS. Every single one must appear in your summary table.**

## Step 4: Build the Action Plan

Build one plan table that combines verification, triage, action selection, and proposed replies. The user uses this table to make their one decision in Step 6, so it must be complete and concrete.

**For each comment, determine:**

- **Author** and whether they're a human reviewer. Anything not obviously a bot is human. Common bots: `dependabot[bot]`, `github-actions[bot]`, `renovate[bot]`, `codecov[bot]`, `sonarcloud[bot]`, anything with a `[bot]` suffix.
- **What the reviewer asked**, paraphrased short.
- **Action**, one of:
    - **Fix**: make the code change.
    - **Needs your input**: the comment is a question only the PR author can answer (e.g., "why did you choose X over Y?", "how does this interact with Z?"), or you're not sure how to interpret the feedback. Don't fabricate an answer; Step 5 pauses to collect the author's input.
    - **Skip with reply**: the comment is incorrect, out of scope, contradicts other guidance, or is a stylistic suggestion you'll politely push back on. The reply field carries the reasoning.
    - **Defer to follow-up**: valid but too big for this PR; will be tracked separately and the reply explains where.
- **Proposed fix or reply** in concrete terms (the actual code change, or the reply draft). For "Needs your input", leave this blank; it gets filled in after Step 5.
- **Complexity**: Quick (1-2 files, <20 lines), Session (2-5 files, <100 lines), Major (>5 files or >100 lines).

**SUPER CRITICAL: human reviewer comments carry far more weight than bot output.** A bot flags a missing changelog entry; a human says "this design is wrong" or "you missed a real bug." Default to acting on human feedback. Skipping or deferring a human comment requires a real, defensible reason, and the reply needs to be substantive and respectful, not boilerplate. Bot comments can be skipped or batch-acknowledged with much less ceremony.

**Watch out for human reviewers asking questions, not requesting changes.** If a human asks "why did you pick this approach?" or "did you consider X?", the right action is usually **Needs your input**, not Fix. You're the assistant, not the PR author; you don't know why they made the design choices they did. Surface those for the author to answer in their own words.

Present the plan in one table:

| # | Author | Human? | File/Location | Reviewer asked | Proposed fix or reply | Action | Complexity |
|---|--------|--------|---------------|----------------|-----------------------|--------|------------|
| 1 | @reviewer1 | yes | `foo.cpp:42` | Missing null check | Add `if (!ptr) return;` before deref on line 42 | Fix | Quick |
| 2 | @reviewer2 | yes | `bar.h:15` | "Why this design over Y?" | (needs your answer) | Needs input | n/a |
| 3 | @reviewer1 | yes | `baz.py:88` | Rename `tmp` | `tmp` is a documented sentinel; reply explaining | Skip w/ reply | n/a |
| 4 | @dependabot[bot] | no | n/a | Bump lodash to 4.17.21 | Out of scope; tracked in follow-up PR #N | Skip w/ reply | n/a |
| 5 | @reviewer2 | yes | General | Refactor auth flow | Out of scope for this PR; will file follow-up issue | Defer | Major |

**Inline verification:** state the row count next to the grand total from Step 3d. "Plan covers N items. Grand total from Step 3d: N. Match." If they don't match, find the missing comments before moving to Step 5.

**Special case: nothing actionable.** If every comment is praise or a non-actionable question, say so plainly and stop here. Do not invent work.

## Step 5: Resolve "Needs Your Input" Items

If any rows in the plan have Action = "Needs input", pause and list just those, then wait for the user's answers. This covers human-reviewer questions, ambiguous feedback you'd rather sanity-check, and anything where you're guessing at intent.

Example prompt:

```
Items I need your input on before I can finalize the plan:

#2 (@reviewer2 on bar.h:15): "Why this design over Y?"
   What's your answer?

#7 (@reviewer1 on auth.go:104): feedback seems to conflict with the convention in style.md. Keep style.md as-is, or update it?
```

Use the user's answers to draft proposed replies. Update the table's Proposed-fix-or-reply column and switch each Action to "Skip with reply" (or "Fix" if the answer reveals an actual change to make). Then proceed to Step 6.

If there were no "Needs input" items, skip straight to Step 6.

## Step 6: Ask the Single Decision

Present the now-complete plan table and ask one question:

**"Want me to execute this plan, or are we merging as-is? Reply 'go' to do the fixes and post replies, 'merge as-is' to leave the code alone (I can still post brief ack replies if you want), or tell me what to change in the plan."**

**STOP HERE.** Do not call Edit, Write, or any modification tool until the user answers.

Possible responses:

- **"go" / "approved" / "do it"**: Proceed to Step 7 and execute the entire plan in one pass.
- **"merge as-is" / "skip" / "don't fix"**: Skip Step 7. Jump to Step 8 and ask whether the user wants brief acknowledgment replies posted (e.g., "Thanks for the review, merging as-is for now"), or to leave the comments untouched. Then go to Step 9.
- **Plan edits** (skip item N, change approach for M, split item): Revise the plan and re-present the full table. Loop until the user says "go" or "merge as-is".
- **Silence, ambiguous responses, or a thumbs-up emoji alone are NOT approval.** Ask again.

## Step 7: Execute the Approved Plan

Only proceed here after Step 6 "go". **Execute the entire plan in one pass without stopping to confirm individual items.** The user already approved every line in the table; re-prompting per fix defeats the purpose.

The only legitimate reasons to pause mid-execution:

- A proposed fix turns out to need a substantially different approach than what was in the plan (e.g., it breaks something, depends on context you didn't have). Surface the change and re-confirm only for the affected item.
- You discover a new issue while making approved fixes that wasn't in the plan. Note it for a follow-up round; do not silently fix it.

For approved quick fixes and session work, work through them grouped by file:

### `path/to/file.cpp`
- [ ] Line 42: Fix the memory leak (quick fix)
- [ ] Line 108: Consider using std::string_view (session)

### `path/to/other.h`
- [ ] Line 15: Add documentation for this function (quick fix)

### Deferred (Major Work)
- [ ] **New Task:** Refactor authentication system -> add to project planning
- [ ] **Follow-up PR:** Performance optimization for large datasets

## Step 8: Close the Loop on GitHub

After addressing feedback items, reply to ALL comments efficiently using the bulk reply script.

### Bulk Reply (Recommended)

Build a JSON array of replies and post them all at once:

```bash
echo '[
  {"id": 12345, "body": "Fixed in `abc123`", "type": "inline"},
  {"id": 67890, "body": "Good catch, updated the validation", "type": "inline"},
  {"id": 11111, "body": "Thanks for the thorough review!", "type": "conversation"}
]' | node ${CLAUDE_SKILL_DIR}/scripts/reply-pr-comments.js
```

Or preview first with `--dry-run`:
```bash
echo '[...]' | node ${CLAUDE_SKILL_DIR}/scripts/reply-pr-comments.js --dry-run
```

**Reply types:**
- `inline`: Reply to inline code comment (most common)
- `conversation`: Add new conversation comment
- `review-body`: Add new conversation comment (for responding to review summaries)

### Single Reply (Alternative)

For individual replies:
```bash
# Inline comment reply
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
  -f body="Addressed in \`{SHORT_SHA}\`"

# New conversation comment
gh api repos/{owner}/{repo}/issues/{pr}/comments \
  -f body="Your message here"
```

### Reply Templates

**When Fixed:**
- `"Fixed in \`{SHORT_SHA}\`"`
- `"Updated - {brief description}"`

**When Skipped:**
- `"Keeping current approach because {reason}"`
- `"Deferring to follow-up PR - created issue #{N}"`

## Step 9: Verify and Close Out

The plan table from Step 7 is the record of what was agreed; no need to re-present it. Just verify and report.

**Verification:** count comments handled (fixed + skipped-with-reply + deferred-with-reply) and confirm it equals the grand total from Step 3d. If it doesn't, find the missing comments and address them before declaring done.

**Close out** with a one-line tally, e.g. "Done: 3 fixed, 1 deferred, 1 skipped with reply (5/5 acknowledged)." If any comment was not addressed or replied to, do NOT consider this task complete.
