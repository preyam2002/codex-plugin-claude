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
