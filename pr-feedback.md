---
allowed-tools: Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh api:*), Bash(git rev-parse:*), Bash(git log:*), Bash(git worktree:*)
description: Fetch and summarize PR feedback for the current branch
---

Review the feedback on the current branch's PR.

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

- If current branch matches PR branch → ✅ Proceed with fixes
- If on `main` but PR is for a feature branch → ⚠️ **STOP**
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
1. ⚠️ **STOP** - Do not proceed to review comments yet
2. Present CI failures as the top priority:

| Check | Status | Details |
|-------|--------|---------|
| build | ❌ Failed | "CMake error on line 42..." |
| tests | ❌ Failed | "2 tests failed in renderer..." |
| lint | ✅ Passed | - |

3. Fix CI failures first:
   - Read the failure logs
   - Identify the root cause
   - Make fixes
   - Push and wait for CI to re-run

4. Only proceed to review comments after CI is green

**If all CI checks pass:**
- ✅ Proceed to Step 3 (fetch review feedback)

**Why CI first:** Reviewers often won't look at a PR with failing CI. Fixing CI failures may also resolve some review comments (e.g., "this doesn't compile" comments become moot).

## Step 3: Fetch ALL PR Data

Use a single `gh pr view` command to get everything:

```bash
gh pr view {PR_NUMBER} --json title,body,commits,files,reviews,comments,labels,headRefOid,updatedAt
```

This retrieves:
- **title, body**: PR description context
- **commits**: All commits on the branch (for determining latest SHA)
- **files**: Changed files list
- **reviews**: Review comments with inline code feedback + approval state
- **comments**: General PR conversation/discussion comments
- **labels**: Any applied labels
- **headRefOid**: Current HEAD SHA of the PR branch
- **updatedAt**: Last update timestamp

## Step 4: Present Summary Table

Display all feedback in a table with columns:
| # | File/Location | Summary | Severity | Status |
|---|---------------|---------|----------|--------|

Where:
- **Severity**: blocking, suggestion, question, nitpick (infer from content/review state)
- **Status**: pending, resolved, outdated (based on whether comment is on current commit)

## Step 5: Triage and Estimate Complexity

For each feedback item, assess:
- **Scope**: How many files/lines affected?
- **Complexity**: Simple rename vs architectural change?
- **Dependencies**: Does fixing this require understanding other systems?

Categorize each item:
| Complexity | Criteria | Example |
|------------|----------|---------|
| **Quick fix** | 1-2 files, <20 lines changed, no new dependencies | Typo, rename, add comment, simple null check |
| **Session work** | 2-5 files, <100 lines changed, contained scope | Refactor function, add error handling, fix logic bug |
| **Major work** | >5 files OR >100 lines OR new systems/dependencies | Architectural change, new feature, performance rewrite |

## Step 6: Determine Action Path

Based on the triage, recommend ONE of three paths:

### Path A: Quick Fixes Only
**When:** All items are quick fixes (total <5 files, <50 lines)
**Action:** Fix everything immediately, no checklist needed

### Path B: Session Checklist
**When:** Mix of quick fixes and session work, but total is manageable in current context
**Action:**
1. Create TodoWrite checklist
2. Fix quick items first
3. Work through session items systematically
4. Present results when done

### Path C: Defer Major Work
**When:** Any major work items exist, OR too many session items to fit in context
**Action:**
1. Fix any quick fixes immediately
2. For major items, ask user to choose:
   - Create a follow-up PR branched from this one
   - Add as new task/epic in project planning docs (if they exist)
   - Defer to a future session
3. Do NOT attempt major work in the feedback session

## Step 7: Present Summary Table

| # | File/Location | Summary | Complexity | Action |
|---|---------------|---------|------------|--------|
| 1 | `foo.cpp:42` | Fix null check | Quick fix | Fix now |
| 2 | `bar.h:15` | Add validation | Session | Checklist |
| 3 | General | Refactor auth flow | Major | Defer -> new task |

## Step 8: Execute Based on Path

For quick fixes and session work, output grouped by file:

### `path/to/file.cpp`
- [ ] Line 42: Fix the memory leak (quick fix)
- [ ] Line 108: Consider using std::string_view (session)

### `path/to/other.h`
- [ ] Line 15: Add documentation for this function (quick fix)

### Deferred (Major Work)
- [ ] **New Task:** Refactor authentication system -> add to project planning
- [ ] **Follow-up PR:** Performance optimization for large datasets

## Step 9: Handle Questionable Feedback

Before implementing, identify any feedback that seems:
- **Incorrect** - Based on a misunderstanding of the code
- **Unnecessary** - Would add complexity without clear benefit
- **Contradictory** - Conflicts with other feedback or project conventions
- **Out of scope** - Valid but belongs in a separate PR/task

**For questionable items:**
1. Present the item to the user with your concern
2. Ask: "Should we address this, skip it, or discuss with the reviewer?"
3. If skipping, draft a polite comment explaining the decision

## Step 10: Close the Loop on GitHub

After addressing each feedback item:

### When Fixed:
Reply to the PR comment thread:
```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
  -f body="Addressed in \`{SHORT_SHA}\`"
```

### When Intentionally Skipped:
Reply explaining why:
```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
  -f body="After discussion, we decided to [skip this / handle separately] because [reason]. [Optional: Created issue #X to track this.]"
```

### Track Comment IDs:
When fetching feedback, note each comment's ID so you can reply to the correct thread.
The `reviews` field contains `comments` with `id` fields for inline review comments.
General PR comments have their own IDs in the `comments` field.

## Step 11: Final Summary

After all items are processed, present:

| # | Feedback | Status | GitHub Reply |
|---|----------|--------|--------------|
| 1 | Fix null check | ✅ Fixed | Replied: "Addressed in `abc123`" |
| 2 | Add validation | ✅ Fixed | Replied: "Addressed in `abc123`" |
| 3 | Refactor auth | ⏭️ Deferred | Replied: "Created task for later" |
| 4 | Change naming | ❌ Skipped | Replied: "Keeping current convention per project standards" |

This ensures nothing falls through the cracks and reviewers see responses to all their feedback.
