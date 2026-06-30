# Specboard workflow (Kevin)

This file is imported by a repo's `CLAUDE.md` as the opt-in marker: **if you're reading this, the current repo tracks its planning in Specboard.** Manage work on the board (via the `specboard` MCP), not in a local status/TODO file.

## Use the Specboard skills

- **What's next / pick up work:** use the `specboard:whats-next` skill — it reads the live board (epics, tasks, bugs, statuses, linked specs) via the MCP.
- **Close work out:** use the `specboard:complete` skill — verify, finalize the PR, then merge and mark the item complete.

Those plugin skills own the universal mechanics. Everything below is just how I like to use them.

## How I work with Specboard

- **Specs live in git; items live in Specboard.** Write and commit spec docs in the repo; create and update the tracking items (epics / tasks / bugs) via the MCP (`create_item`, `create_items`, `update_item`). Link a spec to its epic rather than copying it into task text.
- **Writing specs:** sometimes I'll write the spec myself, sometimes I'm happy to have you draft it — ask if it isn't obvious which.
- **Plan files**, when a task warrants one, go in the project's `.claude/plans/`, not the global `~/.claude/plans/`.
- **Never** put a Specboard project name or UUID in a committed file, commit message, or PR body. The repo's `.mcp.json` holds the project binding; keep everything else generic.
- An AI agent that has **verified** the work (CI green, change confirmed) may run the full loop including merging the PR and closing the item — that's what `specboard:complete` is for. Don't close anything you haven't verified.

## Which project

The repo's `.mcp.json` binds it to one Specboard project via the `X-Specboard-Project` header, so `list_projects` / `get_items` auto-scope to it. No need to ask which project.
