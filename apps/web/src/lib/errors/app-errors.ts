export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function getFirstErrorMessage(errors: unknown[], fallback: string) {
  const error = errors.find(Boolean);
  return error ? getErrorMessage(error, fallback) : "";
}
