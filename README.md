# Claude plugin for Codex

Use Claude from inside Codex for code reviews or to delegate tasks to Claude.

This plugin is for Codex users who want an easy way to start using Claude from the workflow they already have. It is the inverse of [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc), and borrows heavily from its architecture.

## What You Get

- `/claude:review` for a Claude code review
- `/claude:adversarial-review` for a steerable, ship/no-ship pressure-test review
- `/claude:rescue`, `/claude:status`, `/claude:result`, and `/claude:cancel` to delegate work and manage background jobs
- `/claude:setup` to check that Claude is installed and authenticated

## Requirements

- **Anthropic account** with either an active `claude` CLI login or `ANTHROPIC_API_KEY` set.
- **Node.js 18.18 or later**
- **Claude CLI** (`claude --version` should print a version)

## Install

```bash
# 1. Register the marketplace:
codex plugin marketplace add preyam2002/codex-plugin-claude
# or pin a version: preyam2002/codex-plugin-claude@v0.1.0
# or install from a local clone: codex plugin marketplace add /path/to/codex-plugin-claude

# 2. Open Codex, run /plugins, find the claude-bridge marketplace,
#    and install the "claude" plugin. This stages it to
#    ~/.codex/plugins/cache/claude-bridge/claude/<version>/ and writes
#    [plugins."claude@claude-bridge"] in ~/.codex/config.toml.

# 3. Make sure the claude CLI is installed and authenticated:
npm install -g @anthropic-ai/claude-code   # if not already installed
claude /login                              # interactive auth (or set ANTHROPIC_API_KEY)
```

To pull updates later: `codex plugin marketplace upgrade claude-bridge`.

After install, restart Codex and ask "is Claude set up?" — that should route through the `claude-setup` skill.

### Local development reinstall

`codex plugin marketplace upgrade <name>` only works for git-backed marketplaces. For local sources, re-sync the cache manually after edits:

```bash
rm -rf ~/.codex/plugins/cache/claude-bridge/claude/0.1.0
cp -R plugins/claude/. ~/.codex/plugins/cache/claude-bridge/claude/0.1.0/
# then restart codex — plugin loading happens at session start
```

## Usage

Codex plugins do not register custom slash commands. Invoke this plugin's skills with natural language — the Codex orchestrator routes the request to the matching skill based on the description in each `SKILL.md`.

| Skill | Trigger phrases |
| --- | --- |
| `claude-setup` | "is Claude set up?", "check Claude", "is Claude up?" |
| `claude-review` | "have Claude review my changes", "ask Claude for a code review", "second opinion from Claude on this diff" |
| `claude-adversarial-review` | "adversarial review with Claude", "pressure-test this design with Claude", "look for race conditions / auth gaps with Claude" |
| `claude-rescue` | "have Claude take a look", "ask Claude to investigate / fix / refactor X", "delegate this to Claude" |
| `claude-status` | "show Claude jobs", "what Claude jobs are running?", "Claude status" |
| `claude-result` | "what was the last Claude result?", "show Claude output", "get the output from task-xyz" |
| `claude-cancel` | "cancel Claude", "stop the Claude task", "abort Claude" |

You can also pass standard flags inside the natural-language request — the skills strip them out before forwarding to the companion script. For example: "ask Claude to fix the failing test in the background", "have Claude review against main", "resume the last Claude task with --model claude-haiku-4-5".

Supported flags (foreground task / review):

| Flag | Meaning |
| --- | --- |
| `--model <name>` | `sonnet`, `opus`, `claude-sonnet-4-6`, etc. |
| `--effort <level>` | `low` / `medium` / `high` / `xhigh` / `max` |
| `--max-budget-usd <amount>` | hard dollar cap for the invocation |
| `--fork-session` | with `--resume`, branch into a new session id instead of overwriting |
| `--allowed-tools <list>` / `--disallowed-tools <list>` | comma-separated tool gating (e.g. `Bash,Edit`) |
| `--background` / `--wait` | run detached, then poll with status/result |
| `--write` / `--read-only` | sandbox mode (read-only maps to Claude's `plan` permission) |

Each completed task prints a telemetry footer:

```
_duration 2.1s · cost $0.1980 · tokens in/out 6/7 · model claude-opus-4-7_
```

Foreground runs stream live progress to stderr as Claude works (one line per assistant message / tool use), so you no longer sit on a silent prompt for 30+ seconds.

## How it works

The plugin wraps the `claude` CLI in `--print` mode and tracks each invocation as a job under `${CODEX_PLUGIN_DATA}/state/<workspace>/`. Background tasks spawn a detached `node` worker that runs the same companion script with `task-worker --job-id <id>`.

Inspired by [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) — the directory layout, job-state lifecycle, and skill/command boundary are deliberately parallel so users moving between the two plugins find them familiar.

## FAQ

### Do I need a separate Claude account for this plugin?

If `claude` is already logged in on this machine, that login works here too. The plugin shells out to the local `claude` CLI and uses the same authentication state.

### Does the plugin use a separate Claude runtime?

No. It delegates through your local Claude CLI on the same machine.

### What about Claude API key vs ChatGPT/Anthropic login?

Either works. Set `ANTHROPIC_API_KEY` to override, or rely on `claude /login` (Pro/Team/Max).

## License

MIT
