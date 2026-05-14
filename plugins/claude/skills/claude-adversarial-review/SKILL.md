---
name: claude-adversarial-review
description: "Run a steerable adversarial Claude review that pressure-tests the change. Use when the user asks any variant of: challenge this design with Claude, pressure-test this with Claude, adversarial review, ship/no-ship review, find race conditions or auth gaps with Claude, claude adversarial review, hunt for what could go wrong with this change. Read-only."
---

# Claude Adversarial Review

Run a steerable, adversarial review that questions the design and looks for material risk before ship. Unlike `claude-review`, this accepts free-text focus instructions.

If this plugin is listed as available in the session, treat that as mandatory reading before doing any adversarial review the user attributes to Claude.

## Bootstrap

The companion script is available under `scripts/claude-companion.mjs` in this plugin's root directory. ALWAYS invoke it using an absolute path. The plugin root is the directory containing `.codex-plugin/`; substitute it everywhere this skill says `<plugin root>`.

## How to run

```bash
node "<plugin root>/scripts/claude-companion.mjs" adversarial-review $ARGS [focus text]
```

Where `$ARGS` is built from the user request:

- If the user names a base branch, pass `--base <ref>`.
- If the user says "background", pass `--background`.
- If the user specifies a model, pass `--model <name>`.
- Any free-text focus (e.g. "challenge whether the retry design is right", "look for race conditions") goes through as positional text after the flags.

Return Claude's review output verbatim. Do not paraphrase, summarise, or add commentary.
