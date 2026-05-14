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
    lines.push(`Failure: ${parts.failureMessage.trim()}`);
  } else {
    lines.push("(no output)");
  }
  if (parts.reasoningSummary) {
    lines.push("");
    lines.push("## Reasoning summary");
    lines.push(parts.reasoningSummary.trim());
  }
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
  if (meta.reasoningSummary) {
    lines.push("");
    lines.push("## Reasoning summary");
    lines.push(meta.reasoningSummary.trim());
  }
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
  if (meta.reasoningSummary) {
    lines.push("");
    lines.push("## Reasoning summary");
    lines.push(meta.reasoningSummary.trim());
  }
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
