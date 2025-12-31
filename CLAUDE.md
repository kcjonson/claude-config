# Global Claude Instructions

## Git Commits

- Do not mention AI/agent generation in commit messages
- Do not add "Co-Authored-By: Claude" or similar attribution
- Commit messages should appear as if written by me

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
