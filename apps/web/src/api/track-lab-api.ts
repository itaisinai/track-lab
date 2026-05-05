import type { SavedTrackResult, TrackAnalysisJob, TrackAnalysisJobStatus } from "../types";

const API_BASE_URL = "http://localhost:3000";

export type RunAgentOptions = {
  operation?: "analyze" | "enrich";
  skipPersistedResults?: boolean;
  knownMetadata?: unknown;
  track?: {
    title: string;
    artists: string;
  };
};

export async function runAgent(message: string, options: RunAgentOptions = {}) {
  return request<{ job: Pick<TrackAnalysisJob, "id" | "status"> }>("/agent", {
    method: "POST",
    body: JSON.stringify({
      message,
      track: options.track,
      operation: options.operation ?? "analyze",
      skipPersistedResults: options.skipPersistedResults ?? false,
      knownMetadata: options.knownMetadata,
    }),
  });
}

export async function saveAgentResponse(agentResponse: unknown) {
  const data = await request<{ result: SavedTrackResult }>("/results", {
    method: "POST",
    body: JSON.stringify({ agentResponse }),
  });

  return data.result;
}

export async function listResults() {
  const data = await request<{ results: SavedTrackResult[] }>("/results");
  return data.results;
}

export async function reenrichSavedResult(id: number) {
  return request<{ job: Pick<TrackAnalysisJob, "id" | "status"> }>(`/results/${id}/enrich`, {
    method: "POST",
  });
}

export async function deleteSavedResult(id: number) {
  await request<void>(`/results/${id}`, {
    method: "DELETE",
  });
}

export async function listTrackAnalysisJobs(options: {
  statuses?: TrackAnalysisJobStatus[];
  unresolved?: boolean;
  unread?: boolean;
} = {}) {
  const params = new URLSearchParams();

  if (options.statuses?.length) {
    params.set("status", options.statuses.join(","));
  }

  if (options.unresolved) {
    params.set("unresolved", "true");
  }

  if (options.unread) {
    params.set("unread", "true");
  }

  const query = params.toString();
  const data = await request<{ jobs: TrackAnalysisJob[] }>(
    `/track-analysis/jobs${query ? `?${query}` : ""}`,
  );
  return data.jobs;
}

export async function getTrackAnalysisJob(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(`/track-analysis/jobs/${id}`);
  return data.job;
}

export async function retryTrackAnalysisJob(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    `/track-analysis/jobs/${id}/retry`,
    { method: "POST" },
  );
  return data.job;
}

export async function resolveTrackAnalysisJob(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    `/track-analysis/jobs/${id}/resolve`,
    { method: "POST" },
  );
  return data.job;
}

export async function markTrackAnalysisNotificationRead(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    `/track-analysis/jobs/${id}/notification-read`,
    { method: "POST" },
  );
  return data.job;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data as T;
}
