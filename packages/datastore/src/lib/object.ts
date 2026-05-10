export function assertRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Saved enrichment response must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

export function findValue(record: Record<string, unknown>, names: string[]) {
  const normalizedNames = new Set(names.map(normalizeKey));
  const entry = Object.entries(record).find(([key]) =>
    normalizedNames.has(normalizeKey(key)),
  );

  return entry?.[1];
}

export function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeUniqueKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function valueToString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

export function valueToNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function valueToBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}
