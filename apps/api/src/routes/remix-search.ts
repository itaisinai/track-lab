import type {
  RemixSearchRequest,
  SaveRemixCandidateRequest,
} from "@track-lab/api-types";
import type { RemixResultStore } from "@track-lab/datastore";
import { RemixSearchOrchestrator } from "@track-lab/remix-search";
import { Router, type Request, type Response } from "express";

export function createRemixSearchRouter(
  orchestrator = new RemixSearchOrchestrator(),
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

  router.post("/remix-search", async (req: Request, res: Response) => {
    try {
      const result = await orchestrator.search(req.body as RemixSearchRequest);
      res.json(result);
    } catch (error) {
      console.error("Error searching remixes:", error);
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Could not search remixes.",
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
