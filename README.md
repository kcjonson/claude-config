# Claude Config

Personal configuration for [Claude Code](https://claude.com/code): skills and global preferences.

## Structure

```
~/.claude/
├── CLAUDE.md                       # Global instructions applied to every session
└── skills/
    ├── design-review/
    │   └── SKILL.md                # /design-review - visual design review
    ├── pr-feedback/
    │   ├── SKILL.md                # /pr-feedback - fetch and reply to PR comments
    │   └── scripts/
    │       ├── fetch-pr-comments.js
    │       └── reply-pr-comments.js
    └── whats-next/
        └── SKILL.md                # /whats-next - identify the next piece of work
```

Skills follow the [Agent Skills](https://agentskills.io) open standard and the [Claude Code skills spec](https://code.claude.com/docs/en/skills). Each skill is a directory containing a `SKILL.md` with YAML frontmatter plus any supporting files. Claude reads the frontmatter at startup and may auto-invoke a skill when its `description` matches the request, or you can call it directly as `/skill-name`.

This repo previously stored workflows under `commands/` and helper code under `scripts/`. Both have been folded into the skills layout: command bodies became `SKILL.md` files, and helpers live alongside the skill that uses them.

## Skills

### `/design-review`

Reviews visible UI for visual design quality against universal principles. Auto-invoked when Claude detects a UI/visual review request.

Covers: spatial design (proximity, alignment, hierarchy, rhythm), color and contrast, typography, interaction and feedback, accessibility, forms, and layout responsiveness. Platform-agnostic.

### `/pr-feedback`

Fetches and helps address GitHub PR review comments for the current branch. Marked `disable-model-invocation: true` since it posts replies to GitHub, so it only runs when you call it.

Checks CI first, fetches every comment with the bundled `fetch-pr-comments.js` script, triages by complexity, walks through fixes with worktree awareness, then bulk-replies via `reply-pr-comments.js`. Verifies the final comment count matches the fetched total.

Bundled scripts are referenced inside `SKILL.md` via `${CLAUDE_SKILL_DIR}` so they work whether the skill is installed at the personal, project, or plugin level.

### `/whats-next`

Identifies the next best piece of work to start. Auto-invoked on "what should I work on" style requests.

Checks worktree state, open PRs needing attention, incomplete plan files in project and global locations, and the project's status/tracking doc. Recommends priorities and prepares to begin work.

## Bundled scripts

### `skills/pr-feedback/scripts/fetch-pr-comments.js`

Fetches all PR comments and organizes them hierarchically.

```bash
# Current branch's PR (JSON output)
~/.claude/skills/pr-feedback/scripts/fetch-pr-comments.js

# Markdown output (optimized for Claude consumption)
~/.claude/skills/pr-feedback/scripts/fetch-pr-comments.js --format=markdown

# Specific PR or branch
~/.claude/skills/pr-feedback/scripts/fetch-pr-comments.js 123
~/.claude/skills/pr-feedback/scripts/fetch-pr-comments.js feature/my-branch
```

Output includes all reviews with their inline comments, reply threading, conversation comments, verification stats, and pre-built reply API commands.

### `skills/pr-feedback/scripts/reply-pr-comments.js`

Bulk replies to PR comments.

```bash
echo '[
  {"id": 12345, "body": "Fixed in abc123", "type": "inline"},
  {"id": 67890, "body": "Good catch, updated", "type": "inline"}
]' | ~/.claude/skills/pr-feedback/scripts/reply-pr-comments.js

# Preview without posting
echo '[...]' | ~/.claude/skills/pr-feedback/scripts/reply-pr-comments.js --dry-run

# From file
~/.claude/skills/pr-feedback/scripts/reply-pr-comments.js --file replies.json
```

## CLAUDE.md

Global instructions applied to every Claude Code session. Currently covers commit message preferences (no AI attribution), plan file location and naming, and the requirement to verify completion with the user before marking a plan complete.

## Prerequisites

- [Git](https://git-scm.com/)
- [GitHub CLI](https://cli.github.com/) (`gh`)
- [Node.js](https://nodejs.org/) (for the `pr-feedback` scripts)

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

The `.gitignore` tracks `skills/`, `CLAUDE.md`, `LICENSE`, and `README.md` only. All other Claude Code runtime files (history, settings, todos, plans, etc.) stay local.
