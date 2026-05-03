import type { SavedTrackResult } from "../types";

const API_BASE_URL = "http://localhost:3000";

export async function runAgent(message: string) {
  return request<unknown>("/agent", {
    method: "POST",
    body: JSON.stringify({ message }),
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data as T;
}
