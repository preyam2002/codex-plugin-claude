---
name: claude-cancel
description: "Cancel an active background Claude job. Use when the user asks any variant of: cancel claude, stop the claude task, kill claude job, abort claude review, claude cancel, stop the running claude rescue."
---

# Claude Cancel

Cancel an active background Claude job tracked by this plugin.

## Bootstrap

The companion script is available under `scripts/claude-companion.mjs` in this plugin's root directory. ALWAYS invoke it using an absolute path. The plugin root is the directory containing `.codex-plugin/`; substitute it everywhere this skill says `<plugin root>`.

## How to run

```bash
node "<plugin root>/scripts/claude-companion.mjs" cancel $ARGS
```

Where `$ARGS` is:

- Empty if exactly one Claude job is active (the plugin will cancel it).
- A `job-id` to cancel a specific job.

Present the output verbatim.
