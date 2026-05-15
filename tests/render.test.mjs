import test from "node:test";
import assert from "node:assert/strict";

import {
  renderCancelReport,
  renderJobStatusReport,
  renderNativeReviewResult,
  renderReviewResult,
  renderSetupReport,
  renderStatusReport,
  renderStoredJobResult,
  renderTaskResult,
  renderTelemetryFooter
} from "../plugins/claude/scripts/lib/render.mjs";

test("renderSetupReport summarises readiness and next steps", () => {
  const output = renderSetupReport({
    ready: false,
    node: { available: true, detail: "v20" },
    npm: { available: true, detail: "10" },
    claude: { available: false, detail: "not found" },
    auth: { loggedIn: false, source: null, detail: "no creds" },
    nextSteps: ["Install Claude"],
    actionsTaken: []
  });
  assert.match(output, /Claude is not ready/);
  assert.match(output, /claude: MISSING/);
  assert.match(output, /Install Claude/);
});

test("renderTaskResult surfaces output and write flag", () => {
  const out = renderTaskResult(
    { rawOutput: "hello world", failureMessage: "", telemetry: null },
    { title: "Claude Task", jobId: "task-abc", write: true }
  );
  assert.match(out, /# Claude Task \(task-abc\)/);
  assert.match(out, /write-capable run/);
  assert.match(out, /hello world/);
});

test("renderTaskResult appends telemetry footer when present", () => {
  const out = renderTaskResult(
    {
      rawOutput: "ok",
      failureMessage: "",
      telemetry: {
        durationMs: 2935,
        totalCostUsd: 0.2034,
        inputTokens: 5,
        outputTokens: 15,
        cacheReadTokens: 18535,
        numTurns: 1,
        modelsUsed: ["claude-opus-4-7"],
        permissionDenials: []
      }
    },
    { title: "Claude Task", jobId: "task-1", write: false }
  );
  assert.match(out, /duration 2\.9s/);
  assert.match(out, /cost \$0\.2034/);
  assert.match(out, /tokens in\/out 5\/15/);
  assert.match(out, /cache-read 18\.5k/);
  assert.match(out, /claude-opus-4-7/);
});

test("renderTelemetryFooter returns null when nothing useful is present", () => {
  assert.equal(renderTelemetryFooter(null), null);
  assert.equal(renderTelemetryFooter({}), null);
});

test("renderTelemetryFooter highlights api errors and permission denials", () => {
  const footer = renderTelemetryFooter({
    durationMs: 1000,
    apiErrorStatus: "overloaded",
    permissionDenials: [{ tool: "Bash" }]
  });
  assert.match(footer, /api-error overloaded/);
  assert.match(footer, /permission-denials 1/);
});

test("renderReviewResult renders parsed summary and findings", () => {
  const out = renderReviewResult(
    {
      parsed: { summary: "looks risky", findings: [{ severity: "high", title: "f1" }] },
      rawOutput: "",
      parseError: null
    },
    { reviewLabel: "Adversarial Review", targetLabel: "branch", telemetry: null }
  );
  assert.match(out, /Adversarial Review/);
  assert.match(out, /looks risky/);
  assert.match(out, /\[high\] f1/);
});

test("renderNativeReviewResult falls back to stderr on no stdout", () => {
  const out = renderNativeReviewResult(
    { status: 1, stdout: "", stderr: "boom" },
    { reviewLabel: "Review", targetLabel: "working tree", telemetry: null }
  );
  assert.match(out, /Failure: boom/);
});

test("renderStatusReport lists running and recent jobs", () => {
  const out = renderStatusReport({
    workspaceRoot: "/repo",
    running: [{ id: "task-1", status: "running", phase: "running", title: "T1", progressPreview: [] }],
    latestFinished: { id: "task-0", status: "completed", phase: "done", title: "T0", progressPreview: [] },
    recent: []
  });
  assert.match(out, /Running:/);
  assert.match(out, /task-1/);
  assert.match(out, /Latest finished:/);
  assert.match(out, /task-0/);
});

test("renderJobStatusReport includes thread id when present", () => {
  const out = renderJobStatusReport({ id: "task-x", status: "completed", phase: "done", title: "X", threadId: "abc123" });
  assert.match(out, /Thread: abc123/);
});

test("renderStoredJobResult suggests resume command when threadId present", () => {
  const out = renderStoredJobResult(
    { id: "task-x", status: "completed", title: "X", threadId: "sess-1" },
    { rendered: "stored output" }
  );
  assert.match(out, /claude --resume sess-1/);
});

test("renderCancelReport prints the cancelled job id", () => {
  const out = renderCancelReport({ id: "task-x", title: "X" });
  assert.match(out, /Cancelled task-x/);
});
