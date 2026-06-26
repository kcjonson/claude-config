# Development Workflow

## Git Commits

- Do not mention AI/agent generation in commit messages
- Do not add "Co-Authored-By: Claude" or similar attribution
- Commit messages should appear as if written by me

## Branch Naming

- Most of my work isn't ticket-based, so don't force a `<type>/TICKET-ID-kebab-title` branch name. When there's no ticket or type, just use a short descriptive branch name.
- If a ticket (JIRA or Specboard) is already obvious from the context, use the `<type>/TICKET-ID-kebab-title` convention. Don't go searching for one.

## Worktrees

- Default is no worktree: a session launched without `--worktree` works directly in my current checkout on the current branch, editing files in place. That's fine for the common single-task case where I want to watch edits live and there's no competing session.
- Use a whole-session worktree (`claude --worktree <name>`) only for real parallelism, e.g. another session or I am working in the same repo at the same time and edits would collide.
- Use subagent `isolation: "worktree"` when fanning out parallel subagents whose file edits would step on each other within one session.
- `--worktree` auto-names the branch `worktree-<value>`, which ignores branch conventions. For ticket work that needs a convention-compliant branch, create it manually instead: `git worktree add ../dir -b <type>/TICKET-ID-title`, then `cd` in and run `claude`.
- A worktree is a fresh checkout, so untracked files (`.env`, `node_modules`) won't be there; rerun project setup or use a `.worktreeinclude`.

### Cross-repo work

My workflows often edit multiple repos in one session. The isolation rule has to follow me into those other repos, not just the one I launched in.

- Before editing files in a repo other than the launch repo, check whether the current session is running in a worktree (am I under some `.claude/worktrees/<name>/`?). If I launched plain with no worktree, edit the other repo's checkout directly, same as the default.
- If the session IS in a worktree, the other repo must be edited in a matching worktree too, never its main checkout. Check whether that repo already has a worktree of the same `<name>`; if it does, switch to it and edit there. If it doesn't, create one with the same name and branch (`git worktree add <repo>/.claude/worktrees/<name> -b <branch>`), then edit there.
- The point is to keep a session's edits isolated across every repo it touches, so one launch name maps to one worktree per repo. Don't leave half a session's changes in an isolated worktree and the other half in a sibling repo's live checkout.

### Ports in a worktree

When I'm in a worktree and launching anything that binds a port (dev server, preview, storybook, db, etc.), assume another worktree may already hold the default port. Check whether the tool takes a port flag or env var (`--port`, `PORT=`, a config field) and set a unique one if so. Pick a non-default port deterministically from the worktree so it stays stable across restarts rather than colliding again. If there's no way to override the port, say so before launching instead of failing on a bind conflict.

## Pull Requests

- Default to opening PRs as drafts (`gh pr create --draft`), especially for anything non-trivial. Small, obvious changes (one-line fixes, typo corrections, trivial config tweaks) can go straight to ready-for-review. When in doubt, draft it.
- For visual work, include a few screenshots in the PR to show the change when it makes sense. If screenshots were already taken during the session, reuse those. CSS changes should usually have a screenshot.

## Plan File Management

### Location

Store plan files in the **project's** `.claude/plans/` directory, not the global `~/.claude/plans/`:
- Path: `{project-root}/.claude/plans/{description}.md`
- Create the directory if it doesn't exist
- This keeps project-specific plans with their project

### Naming Convention

Use descriptive names instead of random strings:
- Format: `{description}.md`
- Examples: `uber-shader.md`, `clipping-system.md`, `auth-refactor.md`
- Keep descriptions short but meaningful (2-4 words, hyphenated)

### Marking Plans Complete

Add this as the **first line** when a plan is complete:
```
# COMPLETE - {date}
```

Example:
```markdown
# COMPLETE - 2025-12-18

# Original Plan Title
...rest of plan...
```

### Completion Verification

**Never assume a plan is complete. Always verify with the user.**

Before marking complete:
1. Review all tasks/steps in the plan
2. Confirm each was actually implemented
3. Ask the user to confirm the work is done
4. Only add `# COMPLETE` after user confirmation
