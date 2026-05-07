import type {
  RemixSearchRequest,
  SaveRemixCandidateRequest,
} from "@track-lab/api-types";
import type { RemixResultStore } from "@track-lab/datastore";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { Router, type Request, type Response } from "express";

export function createRemixSearchRouter(
  orchestrator: TrackAnalysisOrchestrator,
  store?: RemixResultStore,
) {
  const router = Router();

  router.get("/remix-search/saved", (_req: Request, res: Response) => {
    if (!store) {
      res.status(500).json({ error: "Remix store is not configured." });
      return;
    }

    res.json({ remixes: store.listRemixes() });
  });

  router.post("/remix-search", (req: Request, res: Response) => {
    try {
      const job = orchestrator.enqueue({
        operation: "remix_search",
        request: req.body as RemixSearchRequest,
      });
      res.status(202).json({
        job: {
          id: job.id,
          status: job.status,
        },
      });
    } catch (error) {
      console.error("Error enqueueing remix search:", error);
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Could not enqueue remix search.",
      });
    }
  });

  router.post("/remix-search/saved", (req: Request, res: Response) => {
    if (!store) {
      res.status(500).json({ error: "Remix store is not configured." });
      return;
    }

    try {
      const remix = store.saveRemix(req.body as SaveRemixCandidateRequest);
      res.status(201).json({ remix });
    } catch (error) {
      console.error("Error saving remix:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not save remix.",
      });
    }
  });

  return router;
}
