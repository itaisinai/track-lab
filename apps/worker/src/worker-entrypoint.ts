import { TrackAnalysisWorker } from "@track-lab/track-analysis";

const pollIntervalMs = Number(process.env.TRACK_ANALYSIS_WORKER_POLL_MS ?? 1500);
const worker = new TrackAnalysisWorker(undefined, {
  pollIntervalMs,
  onError(error) {
    console.error("Track analysis job failed:", error);
  },
});

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log(`Track analysis worker started. Polling every ${pollIntervalMs}ms.`);
await worker.start();

function stop() {
  console.log("Stopping track analysis worker.");
  worker.stop();
}
