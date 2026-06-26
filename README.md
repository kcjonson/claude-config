# Claude Config

Personal configuration for [Claude Code](https://claude.com/code): skills and global preferences.

## Structure

```
~/.claude/
├── CLAUDE.md                       # Global instructions; imports the two files below
├── writing-style.md                # Prose voice and anti-AI-tell rules
├── dev-workflow.md                 # Commits, branches, worktrees, PRs, plan files
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

Global instructions applied to every Claude Code session. `CLAUDE.md` itself is a thin entry point that `@`-imports two files: `writing-style.md` (prose voice, banned vocabulary, the anti-AI-tell rules) and `dev-workflow.md` (commit message preferences, branch naming, worktree isolation, PR defaults, and plan file location/naming with the requirement to verify completion before marking a plan complete).

## Prerequisites

- [Git](https://git-scm.com/)
- [GitHub CLI](https://cli.github.com/) (`gh`)
- [Node.js](https://nodejs.org/) (for the `pr-feedback` scripts)

## Installation

This repo is **not** cloned into `~/.claude/`. It lives at a stable path of your choosing, which differs per machine (I have several Macs and a couple of Windows boxes, each with the checkout in a different spot). `~/.claude/` then bridges into it. The bridge is the only thing that varies per machine; everything inside the repo is path-independent.

Why it travels: inside the repo, `CLAUDE.md` imports the other rule files with **relative** paths (`@writing-style.md`, `@dev-workflow.md`), which resolve next to `CLAUDE.md` no matter where the repo sits. So wherever you clone it, the internal chain just works. Only the single hop from `~/.claude` into the repo is machine-specific.

That hop is two pieces:

1. **skills** — `~/.claude/skills` has to point at `<repo>/skills` so Claude Code discovers them.
2. **instructions** — your real `~/.claude/CLAUDE.md` stays an untracked local file (it holds your private, machine-specific stuff: git identity, test-account credentials, anything you don't want on GitHub) and adds one `@import` line pointing at this repo's `CLAUDE.md`. That one import drags in `writing-style.md` and `dev-workflow.md` too, via the relative chain above.

### macOS / Linux

```bash
git clone git@github.com:YOUR_USERNAME/claude-config.git ~/code/claude-config
REPO=~/code/claude-config   # wherever you actually cloned it

ln -s "$REPO/skills" ~/.claude/skills          # skills bridge
echo "@$REPO/CLAUDE.md" >> ~/.claude/CLAUDE.md  # instructions bridge
```

### Windows

Use a directory junction for skills (no admin needed, unlike a symlink), and add the import with forward slashes so the path resolves the same way Claude Code expects:

```powershell
git clone git@github.com:YOUR_USERNAME/claude-config.git C:\code\claude-config
$REPO = "C:\code\claude-config"   # wherever you actually cloned it

cmd /c mklink /J "$HOME\.claude\skills" "$REPO\skills"   # skills bridge (junction)
Add-Content "$HOME\.claude\CLAUDE.md" "@$($REPO -replace '\\','/')/CLAUDE.md"  # instructions bridge
```

### Adding new rule files

Add a new top-level `.md` here, import it from `CLAUDE.md` with a relative `@name.md`, and it propagates to every machine on the next pull. No bridge changes, because the bridge only ever points at `CLAUDE.md` and `skills/`.

### Per-machine checklist

So nothing gets dropped when wiring up a new computer:

- [ ] Repo cloned to a stable path (survives reboots; not a temp dir)
- [ ] `~/.claude/skills` resolves to `<repo>/skills` (`readlink ~/.claude/skills` on Unix; `dir "$HOME\.claude"` shows the junction target on Windows)
- [ ] `~/.claude/CLAUDE.md` exists as a real local file and contains the `@<repo>/CLAUDE.md` line
- [ ] Your private secrets live only in `~/.claude/CLAUDE.md`, never in this repo
- [ ] New `.md` rule files are imported from `CLAUDE.md`, not just dropped in the directory

The `.gitignore` tracks `skills/`, `CLAUDE.md`, `writing-style.md`, `dev-workflow.md`, `LICENSE`, and `README.md` only. All other Claude Code runtime files (history, settings, todos, plans, etc.) stay local.
