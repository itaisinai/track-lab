import type { EnqueueTrackAnalysisRequest } from "@track-lab/api-types";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { Router, type Request, type Response } from "express";

export function createAgentRouter(orchestrator: TrackAnalysisOrchestrator) {
  const router = Router();

  router.post("/agent", (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<EnqueueTrackAnalysisRequest>;
      const operation = body.operation === "enrich" ? "enrich" : "analyze";

      const job = orchestrator.enqueue({
        operation,
        track: getTrackFromRequestBody(body),
        source: body.source ?? "manual",
        knownMetadata: operation === "enrich" ? body.knownMetadata : undefined,
      });

      res.status(202).json({
        job: {
          id: job.id,
          status: job.status,
        },
      });
    } catch (error) {
      console.error("Error enqueueing agent job:", error);
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Could not enqueue track analysis.",
      });
    }
  });

  return router;
}

function getTrackFromRequestBody(body: Partial<EnqueueTrackAnalysisRequest>) {
  if (
    body.track &&
    typeof body.track.title === "string" &&
    typeof body.track.artists === "string"
  ) {
    return {
      title: body.track.title,
      artists: body.track.artists,
    };
  }

  throw new Error("Track title and artists are required.");
}
