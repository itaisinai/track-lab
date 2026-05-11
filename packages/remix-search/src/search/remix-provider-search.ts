import { logRemixSearch } from "@track-lab/logger";
import type { RemixSearchCandidate } from "@track-lab/api-types";
import type { RemixSearchContext, RemixSearchProviderModule } from "../types.ts";

export async function searchRemixProviders(
  providers: RemixSearchProviderModule[],
  context: RemixSearchContext,
) {
  const providerResults = await Promise.allSettled(
    providers.map((provider) => provider.search(context)),
  );

  return providerResults.flatMap((result, index) => {
    const providerName = providers[index]?.name ?? "unknown";

    if (result.status === "rejected") {
      logRemixSearch("provider failed", {
        provider: providerName,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
      return [];
    }

    logRemixSearch("provider completed", {
      provider: providerName,
      candidates: result.value.length,
    });

    return result.value;
  }) as RemixSearchCandidate[];
}
