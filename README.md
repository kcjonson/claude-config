# Claude Config

Personal configuration for [Claude Code](https://claude.com/code) - commands, scripts, and preferences.

## Structure

```
~/.claude/
├── CLAUDE.md          # Global instructions for Claude (applied to all projects)
├── commands/          # Custom slash commands
│   ├── pr-feedback.md # /pr-feedback - Fetch and address PR review comments
│   └── whats-next.md  # /whats-next - Identify next piece of work
├── scripts/           # Helper scripts used by commands
│   ├── fetch-pr-comments.js  # Fetch all PR comments hierarchically
│   └── reply-pr-comments.js  # Bulk reply to PR comments
└── .gitignore         # Only tracks commands/, scripts/, CLAUDE.md, README.md
```

## Commands

### `/pr-feedback`

Fetches and helps address GitHub PR review comments for the current branch.

**Features:**
- Checks CI status first (blocks on failures)
- Fetches ALL comments (reviews, inline, conversation)
- Verifies comment count to ensure nothing is missed
- Triages by complexity (quick fix / session work / major)
- Guides through fixes with proper worktree awareness
- Bulk replies to close the loop with reviewers

### `/whats-next`

Identifies the next best piece of work to start.

**Features:**
- Checks for incomplete plans in project and global locations
- Reviews open PRs needing attention
- Identifies stale worktrees for cleanup
- Recommends prioritized next steps

## Scripts

### `fetch-pr-comments.js`

Fetches all PR comments and organizes them hierarchically.

```bash
# Current branch's PR (JSON output)
~/.claude/scripts/fetch-pr-comments.js

# Markdown output (optimized for Claude consumption)
~/.claude/scripts/fetch-pr-comments.js --format=markdown

# Specific PR or branch
~/.claude/scripts/fetch-pr-comments.js 123
~/.claude/scripts/fetch-pr-comments.js feature/my-branch
```

**Output includes:**
- All reviews with their inline comments
- Reply threading (comments and their replies)
- Conversation comments
- Stats for verification
- Pre-built reply API commands

### `reply-pr-comments.js`

Bulk reply to PR comments efficiently.

```bash
# Reply to multiple comments at once
echo '[
  {"id": 12345, "body": "Fixed in abc123", "type": "inline"},
  {"id": 67890, "body": "Good catch, updated", "type": "inline"}
]' | ~/.claude/scripts/reply-pr-comments.js

# Preview without posting
echo '[...]' | ~/.claude/scripts/reply-pr-comments.js --dry-run

# From file
~/.claude/scripts/reply-pr-comments.js --file replies.json
```

## CLAUDE.md

Global instructions applied to all Claude Code sessions. Currently includes:
- Commit message preferences (no AI attribution)
- Plan file management conventions
- Plan completion verification requirements

## Prerequisites

- [Git](https://git-scm.com/)
- [GitHub CLI](https://cli.github.com/) (`gh`)
- [Node.js](https://nodejs.org/) (for scripts)

## Installation

This repo lives at `~/.claude/`. Fork and clone as needed:

```bash
# If starting fresh (fork first, then clone your fork)
git clone git@github.com:YOUR_USERNAME/claude-config.git ~/.claude

# If ~/.claude already exists with other files
cd ~/.claude
git init
git remote add origin git@github.com:YOUR_USERNAME/claude-config.git
git fetch
git checkout main
```

The `.gitignore` ensures only `commands/`, `scripts/`, `CLAUDE.md`, and `README.md` are tracked. All other Claude Code runtime files (history, settings, todos, etc.) remain local-only.
