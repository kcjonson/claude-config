# Claude Commands

This repository provides workflow automation and guidance for managing GitHub branches, worktrees, and pull requests, especially in projects using advanced developer workflows. Its scripts and process documentation are intended for developers working in multi-branch, multi-worktree Git repositories.

## What Is Included?

- **pr-feedback.md**: Steps to retrieve, triage, and address GitHub PR feedback for the current branch. Automates fetching PR review comments, categorizes feedback by complexity, and guides users through addressing and replying to feedback in the correct worktree/branch context.
- **whats-next.md**: Automated decision guide to identify the next best piece of work to start. Includes project status checks (branches, worktrees, PRs), cleanup/support for stale worktrees, and recommendations for prioritizing new tasks or finishing in-progress work.

Both documents rely on command-line Git and GitHub CLI (`gh`) tools, and use Bash scripts/examples.

## Typical Usage

1. **Git Worktree & Branch Management**
   - Easily check context (main vs. worktree, branch status).
   - Clean up stale worktrees and branches based on PR status.
   - Follow best practices for organizing worktrees and branches.

2. **PR Review Automation**
   - Rapidly fetch PR feedback with CLI commands.
   - Summarize and categorize feedback (quick fix, session work, major work).
   - Receive guidance on addressing feedback in the correct context.

3. **Project Guidance**
   - Get recommendations for what to work on next, factoring in current branch/worktree status, PRs, and top-priority items.

## Getting Started

- Install [Git](https://git-scm.com/) and [GitHub CLI](https://cli.github.com/).
- Clone your target repo and set up worktrees using the commands in the guides.
- Run the suggested Bash commands for managing worktrees and addressing PR feedback.