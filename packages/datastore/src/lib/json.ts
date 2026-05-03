export function parseJsonFromResponse(response: string): unknown {
  const fencedJson = response.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fencedJson ?? response;

  try {
    return JSON.parse(candidate);
  } catch {
    const objectText = candidate.match(/\{[\s\S]*\}/)?.[0];

    if (!objectText) {
      return null;
    }

    try {
      return JSON.parse(objectText);
    } catch {
      return null;
    }
  }
}

export function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseJsonArray<T>(value: string): T[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
