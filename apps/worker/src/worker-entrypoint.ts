import { TrackAnalysisWorker } from "@track-lab/track-analysis";
import { createScopedLogger } from "@track-lab/logger";

const pollIntervalMs = Number(process.env.TRACK_ANALYSIS_WORKER_POLL_MS ?? 1500);
const log = createScopedLogger("worker");
const worker = new TrackAnalysisWorker(undefined, {
  pollIntervalMs,
  onError(error) {
    console.error("Track analysis job failed:", error);
  },
});

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

log("track analysis worker started", { pollIntervalMs });
await worker.start();

function stop() {
  log("stopping track analysis worker");
  worker.stop();
}
