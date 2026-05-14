---
name: claude-status
description: "Show running and recent Claude jobs for the current repository. Use when the user asks any variant of: show claude jobs, what claude jobs are running, claude status, status of claude tasks, is the claude rescue still running, list claude jobs, claude job state."
---

# Claude Status

Show running and recent Claude jobs tracked by this plugin in the current repository.

## Bootstrap

The companion script is available under `scripts/claude-companion.mjs` in this plugin's root directory. ALWAYS invoke it using an absolute path. The plugin root is the directory containing `.codex-plugin/`; substitute it everywhere this skill says `<plugin root>`.

## How to run

```bash
node "<plugin root>/scripts/claude-companion.mjs" status $ARGS
```

Where `$ARGS` is:

- Empty for an overview of all jobs.
- A `job-id` for a single-job detail view.
- Add `--all` for the full history (default is the most recent few).
- Add `--wait` (with a job-id) to block until that job leaves the running state.

Present the output verbatim.
