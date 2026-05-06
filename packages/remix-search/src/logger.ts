export function logRemixSearch(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[remix-search] ${message}`, details);
    return;
  }

  console.log(`[remix-search] ${message}`);
}

export function logRemixProvider(
  provider: string,
  message: string,
  details?: Record<string, unknown>,
) {
  if (details) {
    console.log(`[remix-search:${provider}] ${message}`, details);
    return;
  }

  console.log(`[remix-search:${provider}] ${message}`);
}
