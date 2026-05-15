import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { binaryAvailable } from "./process.mjs";

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
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : raw;
  try {
    return { parsed: JSON.parse(body), parseError: null, rawOutput: body };
  } catch (error) {
    return { parsed: null, parseError: error.message, rawOutput: body };
  }
}

function normalizeValue(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeList(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const cleaned = value.map((v) => String(v).trim()).filter(Boolean);
    return cleaned.length ? cleaned : null;
  }
  const tokens = String(value).split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
  return tokens.length ? tokens : null;
}

const VALID_EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh", "max"]);

function buildClaudeArgs(options = {}) {
  const args = ["--print", "--output-format", "stream-json", "--verbose"];
  const model = normalizeValue(options.model);
  if (model) {
    args.push("--model", model);
  }
  const effort = normalizeValue(options.effort);
  if (effort && VALID_EFFORT_LEVELS.has(effort)) {
    args.push("--effort", effort);
  }
  if (options.resumeThreadId) {
    args.push("--resume", options.resumeThreadId);
  }
  if (options.forkSession) {
    args.push("--fork-session");
  }
  if (options.maxTurns != null && Number.isFinite(Number(options.maxTurns))) {
    args.push("--max-turns", String(Math.floor(Number(options.maxTurns))));
  }
  if (options.maxBudgetUsd != null && Number.isFinite(Number(options.maxBudgetUsd))) {
    args.push("--max-budget-usd", String(Number(options.maxBudgetUsd)));
  }
  const allowed = normalizeList(options.allowedTools);
  if (allowed) {
    args.push("--allowed-tools", allowed.join(","));
  }
  const disallowed = normalizeList(options.disallowedTools);
  if (disallowed) {
    args.push("--disallowed-tools", disallowed.join(","));
  }
  if (options.sandbox === "read-only") {
    args.push("--permission-mode", "plan");
  }
  return args;
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

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function shortPreview(text, limit = 120) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit - 3)}...`;
}

function extractAssistantText(message) {
  if (!message || !Array.isArray(message.content)) return "";
  return message.content
    .filter((part) => part && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function extractToolUses(message) {
  if (!message || !Array.isArray(message.content)) return [];
  return message.content
    .filter((part) => part && part.type === "tool_use" && typeof part.name === "string")
    .map((part) => part.name);
}

function buildTelemetryFromResultEvent(event) {
  if (!event || event.type !== "result") return null;
  const usage = event.usage ?? {};
  const totalInputTokens =
    (Number(usage.input_tokens) || 0) +
    (Number(usage.cache_creation_input_tokens) || 0) +
    (Number(usage.cache_read_input_tokens) || 0);
  const modelUsage = event.modelUsage && typeof event.modelUsage === "object" ? event.modelUsage : {};
  const modelsUsed = Object.keys(modelUsage);
  return {
    isError: Boolean(event.is_error),
    apiErrorStatus: event.api_error_status ?? null,
    stopReason: event.stop_reason ?? null,
    terminalReason: event.terminal_reason ?? null,
    sessionId: event.session_id ?? null,
    numTurns: event.num_turns ?? null,
    durationMs: event.duration_ms ?? null,
    durationApiMs: event.duration_api_ms ?? null,
    totalCostUsd: typeof event.total_cost_usd === "number" ? event.total_cost_usd : null,
    inputTokens: Number(usage.input_tokens) || 0,
    outputTokens: Number(usage.output_tokens) || 0,
    cacheCreationTokens: Number(usage.cache_creation_input_tokens) || 0,
    cacheReadTokens: Number(usage.cache_read_input_tokens) || 0,
    totalInputTokens,
    modelsUsed,
    modelUsage,
    permissionDenials: Array.isArray(event.permission_denials) ? event.permission_denials : []
  };
}

function spawnClaudeStream(cwd, prompt, args, onEvent) {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const events = [];
    let buffer = "";
    let stderr = "";

    const processLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const event = safeJsonParse(trimmed);
      if (!event) return;
      events.push(event);
      onEvent?.(event);
    };

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        processLine(line);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (buffer) processLine(buffer);
      resolve({ status: 1, events, stderr: stderr || error.message, error });
    });
    child.on("close", (code) => {
      if (buffer) processLine(buffer);
      resolve({ status: code ?? 0, events, stderr, error: null });
    });
    if (prompt) {
      child.stdin.write(prompt);
    }
    child.stdin.end();
  });
}

export async function runClaudeTurn(cwd, options = {}) {
  const prompt = options.prompt || options.defaultPrompt || "";
  const args = buildClaudeArgs(options);
  emitProgress(options.onProgress, { kind: "start", prompt: shortPreview(prompt, 80) });

  let assistantMessageCount = 0;
  const onEvent = (event) => {
    if (event.type === "assistant" && event.message) {
      assistantMessageCount += 1;
      const text = extractAssistantText(event.message);
      const tools = extractToolUses(event.message);
      const preview = text
        ? `Claude (msg ${assistantMessageCount}): ${shortPreview(text)}`
        : tools.length
        ? `Claude (msg ${assistantMessageCount}) tool_use: ${tools.join(", ")}`
        : `Claude (msg ${assistantMessageCount})`;
      emitProgress(options.onProgress, { kind: "assistant", message: preview, raw: event.message });
    } else if (event.type === "result") {
      emitProgress(options.onProgress, { kind: "result-event", raw: event });
    }
  };

  const result = await spawnClaudeStream(cwd, prompt, args, onEvent);
  emitProgress(options.onProgress, { kind: "complete", status: result.status });

  const resultEvent = result.events.find((event) => event && event.type === "result") ?? null;
  const finalMessage = resultEvent?.result ?? "";
  const threadId = resultEvent?.session_id ?? null;
  const telemetry = buildTelemetryFromResultEvent(resultEvent);

  // Treat is_error or non-empty api_error_status as failure even on exit 0.
  const effectiveStatus =
    result.status !== 0 ? result.status : telemetry?.isError ? 1 : 0;

  return {
    status: effectiveStatus,
    rawExitStatus: result.status,
    stderr: result.stderr,
    error: result.error,
    finalMessage,
    threadId,
    telemetry,
    events: result.events
  };
}

export async function runClaudeReview(cwd, options = {}) {
  return runClaudeTurn(cwd, options);
}

export async function interruptClaudeTurn() {
  return { attempted: false, interrupted: false, detail: "claude --print is one-shot" };
}

export function findLatestTaskThread() {
  return null;
}
