import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPersistentTaskThreadName,
  parseStructuredOutput,
  getClaudeAuthStatus,
  getSessionRuntimeStatus
} from "../plugins/claude/scripts/lib/claude.mjs";

test("buildPersistentTaskThreadName truncates to first eight tokens", () => {
  const name = buildPersistentTaskThreadName("fix the failing test in the user authentication flow tonight");
  assert.equal(name.split(/\s+/).length, 8);
});

test("buildPersistentTaskThreadName falls back when prompt is empty", () => {
  assert.equal(buildPersistentTaskThreadName(""), "Claude task");
  assert.equal(buildPersistentTaskThreadName(null), "Claude task");
});

test("parseStructuredOutput parses fenced JSON", () => {
  const result = parseStructuredOutput("```json\n{\"summary\": \"ok\"}\n```");
  assert.equal(result.parseError, null);
  assert.deepEqual(result.parsed, { summary: "ok" });
});

test("parseStructuredOutput surfaces parse errors with raw output", () => {
  const result = parseStructuredOutput("not json");
  assert.equal(result.parsed, null);
  assert.match(result.parseError, /Unexpected/);
  assert.equal(result.rawOutput, "not json");
});

test("parseStructuredOutput uses fallback message when input is empty", () => {
  const result = parseStructuredOutput("", { failureMessage: "claude bailed out" });
  assert.equal(result.parseError, "claude bailed out");
});

test("getClaudeAuthStatus reports env-based auth when ANTHROPIC_API_KEY is set", async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  try {
    const status = await getClaudeAuthStatus();
    assert.equal(status.loggedIn, true);
    assert.equal(status.source, "env");
  } finally {
    if (previous == null) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
});

test("getSessionRuntimeStatus reads CODEX_SESSION_ID from supplied env", () => {
  const status = getSessionRuntimeStatus({ CODEX_SESSION_ID: "sess-42" });
  assert.equal(status.inCodexSession, true);
  assert.equal(status.sessionId, "sess-42");
});

test("runClaudeTurn extracts telemetry from a stream-json transcript", async (t) => {
  // Stub the CLAUDE_BIN to a tiny node script that emits stream-json events.
  const fixture = new URL("./fixtures/fake-claude.mjs", import.meta.url);
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");
  const fixturePath = url.fileURLToPath(fixture);
  await fs.mkdir(path.dirname(fixturePath), { recursive: true });
  await fs.writeFile(
    fixturePath,
    "#!/usr/bin/env node\n" +
      "const events = [\n" +
      "  { type: 'system', subtype: 'init', session_id: 's1', model: 'claude-sonnet-4-6' },\n" +
      "  { type: 'assistant', message: { content: [{ type: 'text', text: 'Working on it.' }] } },\n" +
      "  { type: 'result', subtype: 'success', is_error: false, api_error_status: null,\n" +
      "    duration_ms: 4321, duration_api_ms: 4000, num_turns: 2,\n" +
      "    result: 'Done.', stop_reason: 'end_turn', terminal_reason: 'completed',\n" +
      "    session_id: 's1', total_cost_usd: 0.0123,\n" +
      "    usage: { input_tokens: 12, output_tokens: 34, cache_creation_input_tokens: 10, cache_read_input_tokens: 50 },\n" +
      "    modelUsage: { 'claude-sonnet-4-6': { inputTokens: 12, outputTokens: 34, costUSD: 0.0123 } },\n" +
      "    permission_denials: [] }\n" +
      "];\n" +
      "for (const event of events) {\n" +
      "  process.stdout.write(JSON.stringify(event) + '\\n');\n" +
      "}\n",
    { mode: 0o755 }
  );
  t.after(async () => {
    await fs.rm(fixturePath, { force: true });
  });

  const previousBin = process.env.CLAUDE_BIN;
  process.env.CLAUDE_BIN = fixturePath;
  // Re-import claude.mjs with fresh module to pick up the new env. The exported
  // CLAUDE_BIN is captured at import-time, so we use dynamic import bypass.
  const claudeMod = await import(`../plugins/claude/scripts/lib/claude.mjs?bust=${Date.now()}`);
  try {
    const events = [];
    const result = await claudeMod.runClaudeTurn(process.cwd(), {
      prompt: "say hi",
      onProgress: (event) => events.push(event)
    });
    assert.equal(result.status, 0);
    assert.equal(result.finalMessage, "Done.");
    assert.equal(result.threadId, "s1");
    assert.ok(result.telemetry);
    assert.equal(result.telemetry.totalCostUsd, 0.0123);
    assert.equal(result.telemetry.durationMs, 4321);
    assert.equal(result.telemetry.numTurns, 2);
    assert.equal(result.telemetry.inputTokens, 12);
    assert.equal(result.telemetry.outputTokens, 34);
    assert.equal(result.telemetry.cacheReadTokens, 50);
    assert.deepEqual(result.telemetry.modelsUsed, ["claude-sonnet-4-6"]);
    // Progress sink saw assistant + complete events.
    assert.ok(events.some((event) => event.kind === "assistant"));
    assert.ok(events.some((event) => event.kind === "complete"));
  } finally {
    if (previousBin == null) delete process.env.CLAUDE_BIN;
    else process.env.CLAUDE_BIN = previousBin;
  }
});

test("runClaudeTurn treats is_error: true as failure even with exit 0", async (t) => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");
  const fixture = new URL("./fixtures/fake-claude-err.mjs", import.meta.url);
  const fixturePath = url.fileURLToPath(fixture);
  await fs.mkdir(path.dirname(fixturePath), { recursive: true });
  await fs.writeFile(
    fixturePath,
    "#!/usr/bin/env node\n" +
      "process.stdout.write(JSON.stringify({ type: 'result', subtype: 'error',\n" +
      "  is_error: true, api_error_status: 'overloaded', duration_ms: 100, num_turns: 0,\n" +
      "  result: '', stop_reason: null, session_id: 's2',\n" +
      "  usage: { input_tokens: 1, output_tokens: 0 }, modelUsage: {}, permission_denials: [] }) + '\\n');\n",
    { mode: 0o755 }
  );
  t.after(async () => {
    await fs.rm(fixturePath, { force: true });
  });
  const previousBin = process.env.CLAUDE_BIN;
  process.env.CLAUDE_BIN = fixturePath;
  const claudeMod = await import(`../plugins/claude/scripts/lib/claude.mjs?bust=err-${Date.now()}`);
  try {
    const result = await claudeMod.runClaudeTurn(process.cwd(), { prompt: "x" });
    assert.equal(result.rawExitStatus, 0);
    assert.equal(result.status, 1, "is_error should bump effective status to 1");
    assert.equal(result.telemetry.apiErrorStatus, "overloaded");
    assert.equal(result.telemetry.isError, true);
  } finally {
    if (previousBin == null) delete process.env.CLAUDE_BIN;
    else process.env.CLAUDE_BIN = previousBin;
  }
});
