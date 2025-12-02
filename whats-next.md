---
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(git checkout:*), Bash(git push:*), Bash(git worktree:*), Bash(git rev-parse:*), Bash(gh pr list:*), Bash(gh pr view:*), Glob, Grep, Read
description: Identify and start the next piece of work
---

Help identify what to work on next and prepare to start.

## Step 1: Check CLAUDE.md for Project Overrides

Before using defaults, check if the project's CLAUDE.md specifies:
- Custom status/tracking file location (default: `/docs/status.md`)
- Custom development log location (default: `/docs/development-log.md`)
- Custom docs folder for specs (default: `/docs/`)
- Branch naming conventions
- Any "before starting work" workflow requirements

## Step 2: Check Git, Worktree & PR Status

### 2a: Determine Worktree Context

1. Check if we're in a worktree or main checkout:
   ```bash
   git rev-parse --git-dir
   ```
   - If contains `.git/worktrees/` → we're in a worktree
   - If just `.git` → we're in the main checkout

2. List all worktrees:
   ```bash
   git worktree list
   ```

3. Note the current working directory and branch - this defines what THIS instance should work on.

### 2b: Clean Up Stale Worktrees (if in main checkout)

**Before starting new work, check for worktrees that can be cleaned up.**

Only run this check if we're in the main checkout (not already in a worktree).

#### Check Each Worktree's PR Status

For each worktree (other than main), check its branch's PR status:

```bash
# Get PR status for a branch
gh pr list --state all --head <branch-name> --json state,mergedAt,closedAt,title
```

#### Categorize Worktrees

| PR State | Meaning | Action |
|----------|---------|--------|
| **Merged** | Work completed and in main | ✅ Safe to remove |
| **Closed (not merged)** | PR was abandoned/rejected | ⚠️ Ask user - might be intentionally kept |
| **Open** | Work in progress | Keep - do not remove |
| **No PR exists** | Branch exists but no PR created | ⚠️ Check `git branch --merged` as fallback |

#### Present Cleanup Options

**Worktrees ready for cleanup:**

| Worktree | Branch | PR Status | Action |
|----------|--------|-----------|--------|
| `.worktrees/svg-pipeline` | `feature/svg-pipeline` | ✅ PR #39 merged | Remove? |
| `.worktrees/old-experiment` | `feature/experiment` | ❌ PR #35 closed (not merged) | Remove? |

**⚠️ Warning - Branches without PRs:**

| Worktree | Branch | Git Status | Concern |
|----------|--------|------------|---------|
| `.worktrees/forgotten-work` | `feature/forgotten` | Not merged to main | No PR found - is this abandoned work? |

For branches without PRs:
- If `git branch --merged main` shows it → Might have been pushed directly, safe to remove
- If NOT merged → Warn: "This branch has uncommitted/unpushed work with no PR. Review before removing."

#### Cleanup Commands

If user confirms removal:
```bash
git worktree remove .worktrees/<name>
git branch -d <branch-name>  # Safe delete (only works if merged)
# OR
git branch -D <branch-name>  # Force delete (if closed PR / abandoned)
```

#### Skip if Nothing to Clean

If all worktrees are active (open PRs or current work), proceed silently to next step.

### 2c: Git Status

1. Run `git status` to check:
   - Current branch (are we on main or a feature branch?)
   - Uncommitted changes (don't lose work!)
   - Unpushed commits

2. Run `gh pr list --author=@me` to check:
   - Open PRs that might need attention
   - PRs with review feedback (these take priority!)

3. If on a feature branch with an open PR:
   - Check for unaddressed feedback first
   - Suggest using `/pr-feedback` if there are comments

### Worktree Best Practices

**What worktrees share vs don't share:**
- SHARED: Git object database, refs, remotes
- NOT SHARED: Working files, index/staging, HEAD

**Key principles:**
1. **Main checkout = main branch only** - Don't do feature work there
2. **Small changes OK on main** - Docs, typos, config tweaks can go directly
3. **Substantial work → worktree** - Anything touching code or multiple files
4. **Warn about conflicts** - Before editing in main, check if worktrees touch same files
5. **Keep worktrees fresh** - Periodically rebase feature branches onto main

**Worktree organization:**
- Location: `.worktrees/<branch-name>/` (hidden subdirectory)
- Create: `git worktree add -b feature/<name> .worktrees/<name>`
- Remove when done: `git worktree remove .worktrees/<name>`

## Step 3: Read Project Status

Look for a status/tracking file (check CLAUDE.md for location, default `/docs/status.md`):

1. Identify **in-progress work**:
   - Explicitly marked "in progress"
   - Partially completed (some tasks checked, some not)
   - Recently worked on (check development log if ambiguous)

2. Identify **what's next**:
   - Tasks marked "ready" or with no blockers
   - Consider dependencies between epics/tasks
   - Note any blockers or issues

3. If no status file exists, ask the user what they want to work on.

## Step 4: Present Options

Present findings clearly:

### Current State
- Branch: `main` / `feature/xyz`
- Worktree: main checkout / `.worktrees/<name>`
- Open PRs: [list or "none"]
- Uncommitted work: [yes/no]

### In Progress
| Epic/Task | Status | Notes |
|-----------|--------|-------|
| ... | ... | ... |

### Ready to Start
| Epic/Task | Dependencies | Priority |
|-----------|--------------|----------|
| ... | ... | ... |

### Recommendation
Based on the above, suggest what to work on (prioritize: finish in-progress > address PR feedback > start new work)

## Step 5: Prepare for Work (after user confirms)

Once the user picks a task:

1. **Read relevant docs**
   - Look in `/docs/` (or CLAUDE.md-specified location) for:
     - Technical specs related to the task
     - Design docs
     - Any prior thinking/decisions
   - Read the spec/documentation field from the status entry if it exists

2. **Gather code context**
   - Identify which files/systems are involved
   - Read key files to understand current state

3. **Confirm understanding**
   - Summarize what the task involves
   - Note any questions or ambiguities
   - Wait for user confirmation before making changes

## Step 6: Start Work

After user confirms:

### 6a: Determine Work Location

**If on main checkout and task is substantial:**
1. Ask: "This looks like substantial work. Create a worktree at `.worktrees/<name>`?"
2. If yes:
   ```bash
   git worktree add -b feature/<name> .worktrees/<name>
   ```
3. Inform user: "Worktree created. To work there, open a new terminal at `.worktrees/<name>` or use `cd .worktrees/<name>`"
4. Note: Claude cannot change directories mid-session, so user needs to start new session in worktree

**If on main checkout and task is trivial:**
1. Small docs/config changes can proceed directly on main
2. Warn if other worktrees exist that might touch same files

**If already in a worktree:**
1. Continue working in current worktree
2. The branch is already set up

### 6b: Create Branch (if needed)

If working directly (no worktree) and not on main:
- Use project's branch naming convention if specified in CLAUDE.md
- Default: `feature/short-description` or `fix/short-description`

### 6c: Update Status & Begin

1. **Update status doc**:
   - Mark the task as in-progress
   - Update "Last Updated" timestamp

2. **Commit and push**:
   - Commit the status change
   - Push the branch to create remote tracking

3. **Ready to work**:
   - Present a summary of what we're about to do
   - Begin implementation

## Fallback Behavior

If no status file or CLAUDE.md exists:
1. Check for common locations (`/docs/status.md`, `/TODO.md`, `/ROADMAP.md`)
2. If nothing found, ask the user: "I don't see a status/tracking file. What would you like to work on?"
