---
name: claude-rescue
description: "Delegate an investigation, bug fix, or substantial coding task to Claude. Use when the user asks any variant of: have Claude take a look at, ask Claude to investigate, get Claude to fix, delegate this to Claude, hand this off to Claude, claude rescue, get a second pass from Claude, ask Claude. Default to write-capable runs unless the user asks for read-only/diagnosis-only."
---

# Claude Rescue

Hand a task off to Claude — investigation, bug fix, implementation, refactor, or follow-up work.

If this plugin is listed as available in the session, treat that as mandatory reading before delegating a task to Claude. Do not satisfy the request by trying to do the work yourself with Codex unless the user explicitly asks for that fallback.

## Bootstrap

The companion script is available under `scripts/claude-companion.mjs` in this plugin's root directory. ALWAYS invoke it using an absolute path. The plugin root is the directory containing `.codex-plugin/`; substitute it everywhere this skill says `<plugin root>`.

## Flag handling

Strip these from the task text before forwarding:

- `--background` / `--wait` — execution mode flags. Default to foreground when neither is given.
- `--resume` / `--fresh` — thread routing. If neither is given, run the resume helper first (see below).
- `--write` / `--read-only` — sandbox flags. Default to `--write` unless the user explicitly asks for read-only / diagnosis-only / review-only.
- `--model <name>` — model selection. Pass through verbatim.

## Resume check

If neither `--resume` nor `--fresh` is in the request, first check for a resumable Claude thread:

```bash
node "<plugin root>/scripts/claude-companion.mjs" task-resume-candidate --json
```

If `available: true` and the request reads like a follow-up ("continue", "keep going", "resume", "apply the top fix", "dig deeper"), add `--resume`. Otherwise, use `AskUserQuestion` once with these two options:

- `Continue current Claude thread (Recommended)` — if the request reads like a follow-up
- `Start a new Claude thread (Recommended)` — otherwise

If `available: false`, route normally with no `--resume` or `--fresh`.

## How to run

```bash
node "<plugin root>/scripts/claude-companion.mjs" task [flags] <task text>
```

Return Claude's companion stdout verbatim. Do not paraphrase, summarise, rewrite, or add commentary before or after it.

If the companion reports that Claude is missing or unauthenticated, stop and tell the user to ask "is Claude set up?" first.
