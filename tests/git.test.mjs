import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { initGitRepo, makeTempDir, run } from "./helpers.mjs";
import {
  detectDefaultBranch,
  ensureGitRepository,
  getCurrentBranch,
  getWorkingTreeState,
  resolveReviewTarget
} from "../plugins/claude/scripts/lib/git.mjs";

function commitAll(cwd, message) {
  run("git", ["add", "-A"], { cwd });
  run("git", ["commit", "-m", message], { cwd });
}

test("ensureGitRepository throws outside a repo", () => {
  const dir = makeTempDir();
  assert.throws(() => ensureGitRepository(dir), /must run inside a Git repository/);
});

test("ensureGitRepository returns the repo root inside a repo", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "a.txt"), "hi\n");
  commitAll(repo, "initial");
  const root = ensureGitRepository(repo);
  assert.equal(fs.realpathSync.native(root), fs.realpathSync.native(repo));
});

test("getCurrentBranch returns the working branch", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "a.txt"), "hi\n");
  commitAll(repo, "initial");
  assert.equal(getCurrentBranch(repo), "main");
});

test("getWorkingTreeState detects untracked and staged files", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "yo\n");
  commitAll(repo, "init");
  fs.writeFileSync(path.join(repo, "tracked.txt"), "modified\n");
  fs.writeFileSync(path.join(repo, "new.txt"), "new\n");
  run("git", ["add", "tracked.txt"], { cwd: repo });

  const state = getWorkingTreeState(repo);
  assert.deepEqual(state.staged, ["tracked.txt"]);
  assert.deepEqual(state.untracked, ["new.txt"]);
  assert.equal(state.isDirty, true);
});

test("detectDefaultBranch finds the local main branch", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "a.txt"), "hi\n");
  commitAll(repo, "init");
  assert.equal(detectDefaultBranch(repo), "main");
});

test("resolveReviewTarget falls back to working tree when dirty", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "a.txt"), "hi\n");
  commitAll(repo, "init");
  fs.writeFileSync(path.join(repo, "a.txt"), "dirty\n");
  const target = resolveReviewTarget(repo, { scope: "auto" });
  assert.equal(target.mode, "working-tree");
});
