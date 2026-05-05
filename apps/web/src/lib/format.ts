import type { ProviderStatus } from "../types";

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

export function formatProviders(providers: ProviderStatus[]) {
  if (providers.length === 0) {
    return "None";
  }

  return providers
    .map((provider) => `${provider.name}: ${provider.matched ? "yes" : "no"}`)
    .join(", ");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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
