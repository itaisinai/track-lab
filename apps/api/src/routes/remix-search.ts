import type {
  RemixSearchRequest,
  SaveRemixCandidateRequest,
} from "@track-lab/api-types";
import type { RemixResultRepository } from "@track-lab/datastore";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { Router, type Request, type Response } from "express";

export function createRemixSearchRouter(
  orchestrator: TrackAnalysisOrchestrator,
  store?: RemixResultRepository,
) {
  const router = Router();

  router.get("/remix-search/saved", async (_req: Request, res: Response) => {
    if (!store) {
      res.status(500).json({ error: "Remix store is not configured." });
      return;
    }

    res.json({ remixes: await store.listRemixes() });
  });

  router.post("/remix-search", async (req: Request, res: Response) => {
    try {
      const job = await orchestrator.enqueue({
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

  router.post("/remix-search/saved", async (req: Request, res: Response) => {
    if (!store) {
      res.status(500).json({ error: "Remix store is not configured." });
      return;
    }

    try {
      const remix = await store.saveRemix(req.body as SaveRemixCandidateRequest);
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
