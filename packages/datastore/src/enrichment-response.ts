import type { SaveTrackResultInput } from "./types.ts";
import { parseJsonFromResponse, stringifyJson } from "./lib/json.ts";
import { findValue } from "./lib/object.ts";

export function extractEnrichmentResponse(value: unknown): SaveTrackResultInput {
  const rawResponse = findContent(value) ?? stringifyJson(value);
  const json = parseJsonFromResponse(rawResponse) ?? value;

  return {
    rawResponse,
    json,
  };
}

function findContent(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const content = findContent(item);

      if (content) {
        return content;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  const directContent = findValue(record, ["content"]);

  if (typeof directContent === "string") {
    return directContent;
  }

  for (const nestedValue of Object.values(record)) {
    const content = findContent(nestedValue);

    if (content) {
      return content;
    }
  }

  return null;
}
