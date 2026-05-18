import type {
  EnqueueTrackAnalysisJobInput,
  TrackAnalysisJob,
  TrackAnalysisJobStatus,
} from "./types.ts";
import type { MaybePromise } from "./repository.ts";

export interface TrackAnalysisJobRepository {
  enqueue(input: EnqueueTrackAnalysisJobInput): MaybePromise<TrackAnalysisJob>;
  listJobs(options?: {
    statuses?: TrackAnalysisJobStatus[];
    unresolvedOnly?: boolean;
    unreadOnly?: boolean;
  }): MaybePromise<TrackAnalysisJob[]>;
  getJob(id: number): MaybePromise<TrackAnalysisJob | null>;
  claimNextJob(): MaybePromise<TrackAnalysisJob | null>;
  claimJob(id: number): MaybePromise<TrackAnalysisJob | null>;
  completeJob(id: number, result: unknown): MaybePromise<TrackAnalysisJob | null>;
  failJob(id: number, errorMessage: string): MaybePromise<TrackAnalysisJob | null>;
  retryJob(id: number): MaybePromise<TrackAnalysisJob | null>;
  markNotificationRead(id: number): MaybePromise<TrackAnalysisJob | null>;
  resolveJob(id: number): MaybePromise<TrackAnalysisJob | null>;
}
