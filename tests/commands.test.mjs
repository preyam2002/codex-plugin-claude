import test from "node:test";
import assert from "node:assert/strict";

import { COMPANION_PATH, makeTempDir, run } from "./helpers.mjs";

function runCompanion(args, options = {}) {
  return run(process.execPath, [COMPANION_PATH, ...args], options);
}

test("companion prints usage with --help", () => {
  const result = runCompanion(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /setup/);
  assert.match(result.stdout, /review/);
  assert.match(result.stdout, /task/);
});

test("companion rejects unknown subcommands", () => {
  const result = runCompanion(["bogus"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown subcommand: bogus/);
});

test("companion setup --json returns structured readiness report", () => {
  const pluginData = makeTempDir();
  const result = runCompanion(["setup", "--json"], {
    env: { ...process.env, CODEX_PLUGIN_DATA: pluginData }
  });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(typeof parsed.ready, "boolean");
  assert.ok(parsed.node);
  assert.ok(parsed.claude);
  assert.ok(parsed.auth);
});

test("companion status reports an empty workspace cleanly", () => {
  const workspace = makeTempDir();
  const pluginData = makeTempDir();
  const result = runCompanion(["status", "--cwd", workspace], {
    env: { ...process.env, CODEX_PLUGIN_DATA: pluginData }
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Running: \(none\)/);
});

test("companion task-resume-candidate reports nothing for a fresh workspace", () => {
  const workspace = makeTempDir();
  const pluginData = makeTempDir();
  const result = runCompanion(["task-resume-candidate", "--cwd", workspace, "--json"], {
    env: { ...process.env, CODEX_PLUGIN_DATA: pluginData }
  });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.available, false);
  assert.equal(parsed.candidate, null);
});

test("companion result fails cleanly when no jobs exist", () => {
  const workspace = makeTempDir();
  const pluginData = makeTempDir();
  const result = runCompanion(["result", "--cwd", workspace], {
    env: { ...process.env, CODEX_PLUGIN_DATA: pluginData }
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No finished Claude jobs/);
});
