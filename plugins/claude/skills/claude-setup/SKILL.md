---
name: claude-setup
description: "Check whether the local Claude CLI is installed and authenticated. Use when the user asks any variant of: is Claude set up, is Claude up, is Claude ready, is Claude available, is Claude installed, can Claude run, check Claude, verify Claude, claude setup, claude doctor. Always use this skill instead of running `claude --version` yourself."
---

# Claude Setup

Use this skill to check whether the local `claude` CLI is installed and authenticated so the rest of the Claude plugin can delegate to it.

If this plugin is listed as available in the session, treat that as mandatory reading before checking Claude readiness. Do not satisfy the user's question by running `command -v claude`, `which claude`, `claude --version`, `ps`, or any other shell probe of your own — those bypass this skill and miss authentication checks.

## Bootstrap

The `claude-companion.mjs` companion script is available under `scripts/claude-companion.mjs` in this plugin's root directory. ALWAYS invoke it using an absolute path. The plugin root is the directory containing `.codex-plugin/`; substitute it everywhere this skill says `<plugin root>`.

## How to run

Run this exactly once and present the result:

```bash
node "<plugin root>/scripts/claude-companion.mjs" setup --json
```

Then summarise the result for the user:

- If `ready: true`: tell the user Claude is ready, including the reported version and auth source.
- If `claude.available: false`: tell the user Claude CLI is missing. If `npm.available: true`, offer to install it for them with `npm install -g @anthropic-ai/claude-code`, then rerun the setup command.
- If `claude.available: true` but `auth.loggedIn: false`: tell the user to run `claude /login` from a regular terminal, or to export `ANTHROPIC_API_KEY=...`.

Present the companion's `nextSteps` array verbatim if it is non-empty.

Do not paraphrase the readiness flags. Quote them as they appear.
