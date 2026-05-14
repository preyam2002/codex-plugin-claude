---
name: claude-result
description: "Show the final stored Claude output for a finished job. Use when the user asks any variant of: what was the last claude result, show claude result, claude output, what did claude say, get the final output from claude task X, resume claude session."
---

# Claude Result

Show the final stored output from a finished Claude job.

## Bootstrap

The companion script is available under `scripts/claude-companion.mjs` in this plugin's root directory. ALWAYS invoke it using an absolute path. The plugin root is the directory containing `.codex-plugin/`; substitute it everywhere this skill says `<plugin root>`.

## How to run

```bash
node "<plugin root>/scripts/claude-companion.mjs" result $ARGS
```

Where `$ARGS` is:

- Empty to fetch the latest finished job.
- A `job-id` to fetch a specific job.

The output includes a `claude --resume <session-id>` hint when available so the user can reopen the conversation directly.

Present the output verbatim.
