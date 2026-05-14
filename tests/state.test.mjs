import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { makeTempDir } from "./helpers.mjs";
import {
  generateJobId,
  resolveJobFile,
  resolveJobLogFile,
  resolveStateDir,
  resolveStateFile,
  saveState,
  upsertJob,
  listJobs,
  getConfig,
  setConfig
} from "../plugins/claude/scripts/lib/state.mjs";

test("resolveStateDir uses a temp-backed per-workspace directory by default", () => {
  const previous = process.env.CODEX_PLUGIN_DATA;
  delete process.env.CODEX_PLUGIN_DATA;
  try {
    const workspace = makeTempDir();
    const stateDir = resolveStateDir(workspace);
    assert.equal(stateDir.startsWith(os.tmpdir()), true);
    assert.match(path.basename(stateDir), /.+-[a-f0-9]{16}$/);
  } finally {
    if (previous != null) process.env.CODEX_PLUGIN_DATA = previous;
  }
});

test("resolveStateDir honours CODEX_PLUGIN_DATA", () => {
  const workspace = makeTempDir();
  const pluginDataDir = makeTempDir();
  const previous = process.env.CODEX_PLUGIN_DATA;
  process.env.CODEX_PLUGIN_DATA = pluginDataDir;
  try {
    const stateDir = resolveStateDir(workspace);
    assert.equal(stateDir.startsWith(path.join(pluginDataDir, "state")), true);
  } finally {
    if (previous == null) delete process.env.CODEX_PLUGIN_DATA;
    else process.env.CODEX_PLUGIN_DATA = previous;
  }
});

test("generateJobId produces unique prefixed ids", () => {
  const first = generateJobId("task");
  const second = generateJobId("task");
  assert.match(first, /^task-/);
  assert.notEqual(first, second);
});

test("upsertJob and listJobs round-trip in an isolated workspace", () => {
  const workspace = makeTempDir();
  process.env.CODEX_PLUGIN_DATA = makeTempDir();
  upsertJob(workspace, { id: "task-1", status: "queued", title: "Test job" });
  upsertJob(workspace, { id: "task-1", status: "running" });
  const jobs = listJobs(workspace);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, "task-1");
  assert.equal(jobs[0].status, "running");
  assert.equal(jobs[0].title, "Test job");
});

test("setConfig / getConfig persist values per workspace", () => {
  const workspace = makeTempDir();
  process.env.CODEX_PLUGIN_DATA = makeTempDir();
  setConfig(workspace, "feature", "on");
  assert.equal(getConfig(workspace).feature, "on");
});

test("saveState prunes dropped job artifacts when indexed jobs exceed the cap", () => {
  process.env.CODEX_PLUGIN_DATA = makeTempDir();
  const workspace = makeTempDir();
  const stateFile = resolveStateFile(workspace);
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });

  const jobs = Array.from({ length: 51 }, (_, index) => {
    const jobId = `job-${index}`;
    const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, index, 0)).toISOString();
    const logFile = resolveJobLogFile(workspace, jobId);
    const jobFile = resolveJobFile(workspace, jobId);
    fs.writeFileSync(logFile, `log ${jobId}\n`, "utf8");
    fs.writeFileSync(jobFile, JSON.stringify({ id: jobId, status: "completed" }, null, 2), "utf8");
    return { id: jobId, status: "completed", logFile, updatedAt, createdAt: updatedAt };
  });

  fs.writeFileSync(stateFile, `${JSON.stringify({ version: 1, config: {}, jobs }, null, 2)}\n`, "utf8");
  saveState(workspace, { version: 1, config: {}, jobs });

  const savedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(savedState.jobs.length, 50);
  assert.equal(fs.existsSync(resolveJobFile(workspace, "job-50")), true);
  assert.equal(fs.existsSync(resolveJobFile(workspace, "job-0")), false);
});
