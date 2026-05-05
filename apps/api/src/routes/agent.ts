import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { Router, type Request, type Response } from "express";

export function createAgentRouter(orchestrator: TrackAnalysisOrchestrator) {
  const router = Router();

  router.post("/agent", (req: Request, res: Response) => {
    try {
      const operation = req.body.operation === "enrich" ? "enrich" : "analyze";
      const track = getTrackFromRequest(req);

      const job = orchestrator.enqueue({
        operation,
        track,
        source: "manual",
        knownMetadata:
          operation === "enrich" ? req.body.knownMetadata : undefined,
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

function getTrackFromRequest(req: Request) {
  if (
    req.body.track &&
    typeof req.body.track.title === "string" &&
    typeof req.body.track.artists === "string"
  ) {
    return {
      title: req.body.track.title,
      artists: req.body.track.artists,
    };
  }

  if (typeof req.body.message === "string") {
    const title = matchField(req.body.message, "Title");
    const artists =
      matchField(req.body.message, "Artists") ?? matchField(req.body.message, "Artist");

    if (title && artists) {
      return { title, artists };
    }
  }

  throw new Error("Track title and artists are required.");
}

function matchField(message: string, field: string) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = message.match(new RegExp(`^\\s*${escapedField}\\s*:\\s*(.+)$`, "im"));
  return match?.[1].trim() || null;
}
