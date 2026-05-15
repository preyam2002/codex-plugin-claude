function renderJobLine(job) {
  const id = job.id;
  const status = job.status ?? "unknown";
  const phase = job.phase ? ` ${job.phase}` : "";
  const title = job.title ?? job.kindLabel ?? "Claude job";
  const elapsed = job.elapsed ?? job.duration;
  const elapsedText = elapsed ? ` (${elapsed})` : "";
  return `- ${id} [${status}${phase}] ${title}${elapsedText}`;
}

function renderProgressPreview(lines) {
  if (!lines?.length) return "";
  return ["  Progress:", ...lines.map((line) => `    ${line}`)].join("\n");
}

function formatDuration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds - minutes * 60);
  return `${minutes}m${remSeconds}s`;
}

function formatCost(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(4)}`;
}

function formatTokens(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

export function renderTelemetryFooter(telemetry) {
  if (!telemetry) return null;
  const bits = [];
  const duration = formatDuration(telemetry.durationMs);
  if (duration) bits.push(`duration ${duration}`);
  const cost = formatCost(telemetry.totalCostUsd);
  if (cost) bits.push(`cost ${cost}`);
  const inputTokens = formatTokens(telemetry.inputTokens);
  const outputTokens = formatTokens(telemetry.outputTokens);
  if (inputTokens != null || outputTokens != null) {
    bits.push(`tokens in/out ${inputTokens ?? "?"}/${outputTokens ?? "?"}`);
  }
  const cacheRead = formatTokens(telemetry.cacheReadTokens);
  if (cacheRead != null && telemetry.cacheReadTokens > 0) {
    bits.push(`cache-read ${cacheRead}`);
  }
  if (telemetry.numTurns != null && telemetry.numTurns > 1) {
    bits.push(`turns ${telemetry.numTurns}`);
  }
  if (Array.isArray(telemetry.modelsUsed) && telemetry.modelsUsed.length) {
    bits.push(`model ${telemetry.modelsUsed.join(", ")}`);
  }
  const denials = Array.isArray(telemetry.permissionDenials) ? telemetry.permissionDenials.length : 0;
  if (denials) bits.push(`permission-denials ${denials}`);
  if (telemetry.apiErrorStatus) bits.push(`api-error ${telemetry.apiErrorStatus}`);
  if (!bits.length) return null;
  return `_${bits.join(" · ")}_`;
}

function appendTelemetry(lines, telemetry) {
  const footer = renderTelemetryFooter(telemetry);
  if (footer) {
    lines.push("");
    lines.push(footer);
  }
}

export function renderSetupReport(report) {
  const lines = [];
  lines.push(report.ready ? "Claude is ready." : "Claude is not ready.");
  lines.push(`  node: ${report.node.available ? report.node.detail : "MISSING"}`);
  lines.push(`  npm: ${report.npm.available ? report.npm.detail : "MISSING"}`);
  lines.push(`  claude: ${report.claude.available ? report.claude.detail : "MISSING"}`);
  lines.push(`  auth: ${report.auth.loggedIn ? `OK (${report.auth.source})` : `MISSING — ${report.auth.detail}`}`);
  if (report.actionsTaken?.length) {
    lines.push("");
    lines.push("Actions taken:");
    for (const action of report.actionsTaken) lines.push(`  - ${action}`);
  }
  if (report.nextSteps?.length) {
    lines.push("");
    lines.push("Next steps:");
    for (const step of report.nextSteps) lines.push(`  - ${step}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderTaskResult(parts, meta) {
  const lines = [];
  lines.push(`# ${meta.title}${meta.jobId ? ` (${meta.jobId})` : ""}`);
  if (meta.write) lines.push("(write-capable run)");
  lines.push("");
  if (parts.rawOutput?.trim()) {
    lines.push(parts.rawOutput.trim());
  } else if (parts.failureMessage) {
    lines.push(`Failure: ${String(parts.failureMessage).trim()}`);
  } else {
    lines.push("(no output)");
  }
  appendTelemetry(lines, parts.telemetry);
  return `${lines.join("\n")}\n`;
}

export function renderReviewResult(parsed, meta) {
  const lines = [];
  lines.push(`# Claude ${meta.reviewLabel}`);
  lines.push(`Target: ${meta.targetLabel}`);
  lines.push("");
  if (parsed.parsed) {
    if (parsed.parsed.summary) {
      lines.push("## Summary");
      lines.push(parsed.parsed.summary);
      lines.push("");
    }
    if (Array.isArray(parsed.parsed.findings)) {
      lines.push("## Findings");
      for (const finding of parsed.parsed.findings) {
        const severity = finding.severity ? `[${finding.severity}] ` : "";
        lines.push(`- ${severity}${finding.title ?? finding.summary ?? "Finding"}`);
        if (finding.detail) lines.push(`  ${finding.detail}`);
      }
    }
  } else if (parsed.rawOutput) {
    lines.push(parsed.rawOutput.trim());
  } else if (parsed.parseError) {
    lines.push(`Parse error: ${parsed.parseError}`);
  }
  appendTelemetry(lines, meta.telemetry);
  return `${lines.join("\n")}\n`;
}

export function renderNativeReviewResult(result, meta) {
  const lines = [];
  lines.push(`# Claude ${meta.reviewLabel}`);
  lines.push(`Target: ${meta.targetLabel}`);
  lines.push("");
  if (result.stdout?.trim()) {
    lines.push(result.stdout.trim());
  } else if (result.stderr?.trim()) {
    lines.push(`Failure: ${result.stderr.trim()}`);
  } else {
    lines.push("(no output)");
  }
  appendTelemetry(lines, meta.telemetry);
  return `${lines.join("\n")}\n`;
}

export function renderStatusReport(report) {
  const lines = [];
  lines.push(`Workspace: ${report.workspaceRoot}`);
  lines.push("");
  if (report.running.length) {
    lines.push("Running:");
    for (const job of report.running) {
      lines.push(renderJobLine(job));
      const preview = renderProgressPreview(job.progressPreview);
      if (preview) lines.push(preview);
    }
  } else {
    lines.push("Running: (none)");
  }
  lines.push("");
  if (report.latestFinished) {
    lines.push("Latest finished:");
    lines.push(renderJobLine(report.latestFinished));
  }
  if (report.recent.length) {
    lines.push("");
    lines.push("Recent:");
    for (const job of report.recent) lines.push(renderJobLine(job));
  }
  return `${lines.join("\n")}\n`;
}

export function renderJobStatusReport(job) {
  const lines = [renderJobLine(job)];
  const preview = renderProgressPreview(job.progressPreview);
  if (preview) lines.push(preview);
  if (job.errorMessage) lines.push(`  Error: ${job.errorMessage}`);
  if (job.threadId) lines.push(`  Thread: ${job.threadId}`);
  if (job.telemetry) {
    const footer = renderTelemetryFooter(job.telemetry);
    if (footer) lines.push(`  ${footer}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderStoredJobResult(job, storedJob) {
  const lines = [];
  lines.push(renderJobLine(job));
  lines.push("");
  if (storedJob?.rendered) {
    lines.push(storedJob.rendered.trim());
  } else if (storedJob?.errorMessage) {
    lines.push(`Failure: ${storedJob.errorMessage}`);
  } else if (storedJob?.result?.rawOutput) {
    lines.push(storedJob.result.rawOutput.trim());
  } else {
    lines.push("(no stored output)");
  }
  if (job.threadId) {
    lines.push("");
    lines.push(`Resume with: claude --resume ${job.threadId}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderCancelReport(job) {
  return `Cancelled ${job.id} (${job.title ?? "Claude job"}).\n`;
}
