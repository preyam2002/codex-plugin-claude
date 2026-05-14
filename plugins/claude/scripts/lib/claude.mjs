import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { binaryAvailable, runCommand } from "./process.mjs";

export const DEFAULT_CONTINUE_PROMPT = "Continue.";
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";

export function getClaudeAvailability(cwd) {
  return binaryAvailable(CLAUDE_BIN, ["--version"], { cwd });
}

export async function getClaudeAuthStatus() {
  if (process.env.ANTHROPIC_API_KEY) {
    return { loggedIn: true, source: "env", detail: "ANTHROPIC_API_KEY" };
  }
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    const credsPath = path.join(home, ".claude", ".credentials.json");
    if (fs.existsSync(credsPath)) {
      return { loggedIn: true, source: "credentials", detail: credsPath };
    }
    // On macOS, Claude stores credentials in Keychain, so the absence of a
    // credentials file is not definitive. Treat the presence of ~/.claude/
    // as a soft signal that login was attempted at some point.
    const claudeDir = path.join(home, ".claude");
    if (fs.existsSync(claudeDir)) {
      return { loggedIn: true, source: "keychain", detail: "~/.claude/ present (likely macOS Keychain auth)" };
    }
  }
  return {
    loggedIn: false,
    source: null,
    detail: "no credentials found; run `claude /login` or set ANTHROPIC_API_KEY"
  };
}

export function getSessionRuntimeStatus(env) {
  return {
    inCodexSession: Boolean(env.CODEX_SESSION_ID),
    sessionId: env.CODEX_SESSION_ID ?? null
  };
}

export function buildPersistentTaskThreadName(prompt) {
  const first = String(prompt ?? "").trim().split(/\s+/).slice(0, 8).join(" ");
  return first || "Claude task";
}

export function readOutputSchema(schemaPath) {
  if (!fs.existsSync(schemaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  } catch {
    return null;
  }
}

export function parseStructuredOutput(text, fallback = {}) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return { parsed: null, parseError: fallback.failureMessage ?? "Empty Claude output.", rawOutput: "" };
  }
  // Strip ``` fences if present
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : raw;
  try {
    return { parsed: JSON.parse(body), parseError: null, rawOutput: body };
  } catch (error) {
    return { parsed: null, parseError: error.message, rawOutput: body };
  }
}

function normalizeModel(model) {
  if (!model) return null;
  const m = String(model).trim();
  if (!m) return null;
  return m;
}

function buildClaudeArgs(options = {}) {
  const args = ["--print"];
  const model = normalizeModel(options.model);
  if (model) {
    args.push("--model", model);
  }
  if (options.resumeThreadId) {
    args.push("--resume", options.resumeThreadId);
  }
  if (options.outputJson) {
    args.push("--output-format", "json");
  }
  if (options.maxTurns != null && Number.isFinite(Number(options.maxTurns))) {
    args.push("--max-turns", String(Math.floor(Number(options.maxTurns))));
  }
  // Sandbox mapping: codex's "read-only" → claude's --permission-mode plan;
  //                  codex's "workspace-write" → claude's default tool perms.
  if (options.sandbox === "read-only") {
    args.push("--permission-mode", "plan");
  }
  return args;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function emitProgress(onProgress, event) {
  if (typeof onProgress === "function") {
    try {
      onProgress(event);
    } catch {
      // progress sinks must never throw
    }
  }
}

function spawnClaudeTurn(cwd, prompt, args) {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({ status: 1, stdout, stderr: stderr || error.message, error });
    });
    child.on("close", (code) => {
      resolve({ status: code ?? 0, stdout, stderr, error: null });
    });
    if (prompt) {
      child.stdin.write(prompt);
    }
    child.stdin.end();
  });
}

export async function runClaudeTurn(cwd, options = {}) {
  const prompt = options.prompt || options.defaultPrompt || "";
  const args = buildClaudeArgs({ ...options, outputJson: true });
  emitProgress(options.onProgress, { kind: "start", prompt: prompt.slice(0, 80) });
  const result = await spawnClaudeTurn(cwd, prompt, args);
  emitProgress(options.onProgress, { kind: "complete", status: result.status });

  const parsed = safeJsonParse(result.stdout);
  // claude --output-format json returns an object with shape:
  // { type, subtype, is_error, session_id, result, ... }
  const finalMessage = parsed?.result ?? result.stdout;
  const threadId = parsed?.session_id ?? null;
  const reasoningSummary = parsed?.reasoning_summary ?? null;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
    finalMessage,
    threadId,
    turnId: parsed?.turn_id ?? null,
    reasoningSummary,
    touchedFiles: parsed?.touched_files ?? [],
    raw: parsed
  };
}

export async function runClaudeReview(cwd, options = {}) {
  // For "native review" we just run a structured turn with a review prompt.
  // The companion supplies the prompt via runClaudeTurn already; this helper
  // exists for shape-parity with codex-plugin-cc's app-server review API.
  return runClaudeTurn(cwd, options);
}

export async function interruptClaudeTurn() {
  // The Claude CLI in --print mode is one-shot; interrupts are achieved by
  // terminating the child process group. The caller does that via
  // terminateProcessTree, so this helper just acknowledges.
  return { attempted: false, interrupted: false, detail: "claude --print is one-shot" };
}

export function findLatestTaskThread() {
  // No persistent thread index exists outside `claude` itself. Resume relies
  // on the stored job thread id; return null to defer to the in-state lookup.
  return null;
}
