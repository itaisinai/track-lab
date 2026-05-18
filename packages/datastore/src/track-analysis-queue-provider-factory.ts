import { DatabaseTrackAnalysisQueueProvider } from "./database-track-analysis-queue-provider.ts";
import {
  SqsTrackAnalysisQueueProvider,
  type SqsTrackAnalysisQueueProviderOptions,
} from "./sqs-track-analysis-queue-provider.ts";
import type { TrackAnalysisQueueProvider } from "./track-analysis-queue-provider.ts";

export type TrackAnalysisQueueProviderOptions = {
  provider?: "database" | "sqs";
  sqs?: Omit<SqsTrackAnalysisQueueProviderOptions, "region" | "queueUrl"> & {
    region?: string;
    queueUrl?: string;
  };
};

export function createTrackAnalysisQueueProvider(
  options: TrackAnalysisQueueProviderOptions = {},
): TrackAnalysisQueueProvider {
  const provider = options.provider ?? (process.env.QUEUE_PROVIDER as "database" | "sqs" | undefined) ?? "database";

  if (provider === "sqs") {
    const region = options.sqs?.region ?? process.env.AWS_REGION;
    const queueUrl = options.sqs?.queueUrl ?? process.env.SQS_TRACK_ANALYSIS_QUEUE_URL;

    if (!region) {
      throw new Error("AWS_REGION is required when QUEUE_PROVIDER=sqs.");
    }

    if (!queueUrl) {
      throw new Error("SQS_TRACK_ANALYSIS_QUEUE_URL is required when QUEUE_PROVIDER=sqs.");
    }

    return new SqsTrackAnalysisQueueProvider({
      region,
      queueUrl,
      clientFactory: options.sqs?.clientFactory,
    });
  }

  return new DatabaseTrackAnalysisQueueProvider();
}
