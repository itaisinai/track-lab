import type { AgentMessageMetadata } from "@track-lab/api-types";
import type { ToolExecution } from "../tool-execution.ts";

export function buildAssistantMetadata(
  toolCalls: ToolExecution[],
): AgentMessageMetadata {
  const completed = toolCalls.find(({ call }) => call.status === "completed");
  const metadata: AgentMessageMetadata = {
    toolCallIds: toolCalls.map(({ call }) => call.id),
  };

  if (completed?.call.toolName === "analyze_track") {
    const queuedJob = getQueuedTrackAnalysisJob(completed.result);

    if (queuedJob) {
      metadata.queuedTrackAnalysisJob = queuedJob;
    } else {
      metadata.analysisResult = completed.result;
    }
  }

  if (completed?.call.toolName === "search_remixes") {
    metadata.remixSearchResult =
      completed.result as AgentMessageMetadata["remixSearchResult"];
  }

  const failed = toolCalls.find(({ call }) => call.status === "failed");
  if (failed?.call.errorMessage) {
    metadata.error = failed.call.errorMessage;
  }

  return metadata;
}

export function summarizeToolCalls(toolCalls: ToolExecution[]) {
  const failed = toolCalls.find(({ call }) => call.status === "failed");
  if (failed) {
    return failed.call.errorMessage ?? "The tool call failed.";
  }

  const completed = toolCalls.find(({ call }) => call.status === "completed");
  if (!completed) {
    return "I need a track title and artist, or a Spotify track URL, to continue.";
  }

  if (completed.call.toolName === "search_remixes") {
    const result = completed.result as { candidates?: unknown[] } | null;
    const count = result?.candidates?.length ?? 0;
    return count
      ? `Found ${count} remix candidates.`
      : "I searched for remixes but did not find strong candidates.";
  }

  const result = completed.result as {
    job?: { id?: number; status?: string; operation?: string };
    status?: string;
    summary?: string | null;
  } | null;
  if (typeof result?.job?.id === "number") {
    return `Queued track analysis job #${result.job.id}. The worker will analyze it now; this is not the final result yet.`;
  }

  return result?.summary || `Track analysis ${result?.status ?? "complete"}.`;
}

export function getFinalMessageContent(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const messages = (result as { messages?: unknown[] }).messages;
  const last = messages?.[messages.length - 1];

  if (!last || typeof last !== "object") {
    return null;
  }

  const content = (last as { content?: unknown }).content;
  return typeof content === "string" && content.trim() ? content : null;
}

function getQueuedTrackAnalysisJob(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const job = (result as { job?: unknown }).job;
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    return null;
  }

  const record = job as {
    id?: unknown;
    operation?: unknown;
    status?: unknown;
  };

  if (
    typeof record.id !== "number" ||
    typeof record.operation !== "string" ||
    typeof record.status !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    operation: record.operation as "analyze" | "enrich" | "remix_search",
    status: record.status as "queued" | "processing" | "completed" | "failed" | "dead_lettered",
  };
}
