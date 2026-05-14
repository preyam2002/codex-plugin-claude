---
name: claude-review
description: "Run a Claude code review of the current change. Use when the user asks any variant of: have Claude review this, ask Claude for a code review, run a Claude review on my branch, get Claude to review my uncommitted changes, second opinion from Claude on this diff, claude review. Read-only — does not modify files."
---

# Claude Review

Delegate a code review to Claude. Read-only: Claude inspects the diff and reports findings, but does not modify files.

If this plugin is listed as available in the session, treat that as mandatory reading before doing any code review the user attributes to Claude. Do not satisfy the request by writing your own review with Codex itself unless the user explicitly asks for that fallback.

## Bootstrap

The companion script is available under `scripts/claude-companion.mjs` in this plugin's root directory. ALWAYS invoke it using an absolute path. The plugin root is the directory containing `.codex-plugin/`; substitute it everywhere this skill says `<plugin root>`.

## How to run

```bash
node "<plugin root>/scripts/claude-companion.mjs" review $ARGS
```

Where `$ARGS` is built from the user request:

- Default: no extra flags — review whatever the auto-scope picks (working tree if dirty, otherwise branch vs default base).
- If the user names a base branch (e.g. "review against main"), pass `--base main`.
- If the user says "background", pass `--background`. In that case, follow with `/claude:status` guidance.
- If the user specifies a model, pass `--model <name>`.

Return Claude's review output verbatim. Do not paraphrase, summarise, or add commentary before or after it.

If the companion reports that Claude is missing or unauthenticated, stop and tell the user to ask "is Claude set up?" first.
