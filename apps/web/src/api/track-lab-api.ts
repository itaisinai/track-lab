import type { SavedTrackResult } from "../types";

const API_BASE_URL = "http://localhost:3000";

export type RunAgentOptions = {
  skipPersistedResults?: boolean;
};

export async function runAgent(message: string, options: RunAgentOptions = {}) {
  return request<unknown>("/agent", {
    method: "POST",
    body: JSON.stringify({
      message,
      skipPersistedResults: options.skipPersistedResults ?? false,
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
  return request<unknown>(`/results/${id}/enrich`, {
    method: "POST",
  });
}

export async function deleteSavedResult(id: number) {
  await request<void>(`/results/${id}`, {
    method: "DELETE",
  });
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
