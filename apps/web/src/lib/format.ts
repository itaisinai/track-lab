import type { ToolStatus } from "../types";

export function formatAgentResponse(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "content" in data &&
    typeof data.content === "string"
  ) {
    return data.content;
  }

  return JSON.stringify(data, null, 2);
}

export function formatTools(tools: ToolStatus[]) {
  if (tools.length === 0) {
    return "None";
  }

  return tools
    .map((tool) => `${tool.name}: ${tool.matched ? "yes" : "no"}`)
    .join(", ");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function valueToString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return undefined;
}
